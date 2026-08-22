import type { ResultsFile, SessionConfig, TestDefinition } from "@qarows/shared";
import type { ProjectCommand } from "@qarows/application";
import { parseClientProjectCommand } from "@qarows/application";

export type { ProjectCommand };

export interface RoomSnapshot {
  generation: string;
  revision: number;
  definition: TestDefinition;
  results: ResultsFile;
  session: SessionConfig | null;
}

export type ClientMessage =
  | { type: "ping" }
  | { type: "resync" }
  | {
      type: "command";
      generation: string;
      command: ProjectCommand;
      commandId: string;
    };

export type ServerMessage =
  | { type: "pong" }
  | { type: "snapshot"; snapshot: RoomSnapshot }
  | {
      type: "commandApplied";
      command: ProjectCommand;
      commandId: string;
      user: string;
      revision: number;
      appliedAt: string;
    }
  | {
      type: "commandRejected";
      commandId: string;
      reason: "generation_mismatch";
      snapshot: RoomSnapshot;
    }
  | {
      type: "snapshotReplaced";
      generation: string;
      revision: number;
      snapshot: RoomSnapshot;
    }
  | { type: "error"; message: string };

/** Wire format for DO hibernation auto ping/pong (must match client JSON.stringify). */
export const SYNC_PING_MESSAGE = JSON.stringify({ type: "ping" } satisfies ClientMessage);
export const SYNC_PONG_MESSAGE = JSON.stringify({ type: "pong" } satisfies ServerMessage);

/**
 * transport の上限。フィールド単位の上限（parse-project-command の MAX_TEXT 等）を
 * すべて満たすコマンドは必ずここに収まる必要がある。全項目最大の addBug は
 * 日本語で約 160KB になるため 64KB では足りない（sync-protocol.test.ts で固定）
 */
export const MAX_WS_MESSAGE_BYTES = 256 * 1024;

const textEncoder = new TextEncoder();

/**
 * UTF-8 の実バイト数で判定する。String.length（UTF-16 code unit 数）と比べていたため、
 * 日本語なら 1 文字 3 バイトで上限の約 3 倍まで通っていた。
 * 1 code unit は UTF-8 で最大 3 バイトなので、その範囲なら encode せずに判定できる
 */
export function exceedsMaxWsMessageBytes(raw: string): boolean {
  if (raw.length * 3 <= MAX_WS_MESSAGE_BYTES) return false;
  if (raw.length > MAX_WS_MESSAGE_BYTES) return true;
  return textEncoder.encode(raw).byteLength > MAX_WS_MESSAGE_BYTES;
}

export function parseClientMessage(raw: string): ClientMessage | null {
  // 呼び出し側でも判定しているが、単体で安全な関数にしておく
  if (exceedsMaxWsMessageBytes(raw)) return null;

  try {
    const data = JSON.parse(raw) as ClientMessage;
    if (data.type === "ping" || data.type === "resync") return { type: data.type };
    if (
      data.type === "command" &&
      typeof data.generation === "string" &&
      data.generation.length > 0 &&
      typeof data.commandId === "string" &&
      data.commandId.length > 0
    ) {
      // parse 結果を返す（生の payload は返さない）。未知フィールドを DO 状態・
      // broadcast・D1 に持ち込ませず、添付キー等の正規化もここで確定させる
      const command = parseClientProjectCommand(data.command);
      if (!command) return null;
      return { type: "command", generation: data.generation, commandId: data.commandId, command };
    }
    return null;
  } catch {
    return null;
  }
}

export function send(ws: WebSocket, message: ServerMessage): void {
  ws.send(JSON.stringify(message));
}

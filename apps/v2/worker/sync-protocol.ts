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
      snapshot: RoomSnapshot;
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

export const MAX_WS_MESSAGE_BYTES = 64 * 1024;

export function parseClientMessage(raw: string): ClientMessage | null {
  if (raw.length > MAX_WS_MESSAGE_BYTES) return null;

  try {
    const data = JSON.parse(raw) as ClientMessage;
    if (data.type === "ping") return data;
    if (
      data.type === "command" &&
      typeof data.generation === "string" &&
      data.generation.length > 0 &&
      typeof data.commandId === "string" &&
      data.commandId.length > 0 &&
      parseClientProjectCommand(data.command)
    ) {
      return data;
    }
    return null;
  } catch {
    return null;
  }
}

export function send(ws: WebSocket, message: ServerMessage): void {
  ws.send(JSON.stringify(message));
}

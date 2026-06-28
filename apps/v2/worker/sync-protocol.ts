import type { ResultsFile, SessionConfig, TestDefinition } from "@qarows/shared";

export type SyncDocument = "results" | "session";

export interface RoomSnapshot {
  revision: number;
  definition: TestDefinition;
  results: ResultsFile;
  session: SessionConfig | null;
}

export type ClientMessage =
  | { type: "ping" }
  | {
      type: "patch";
      document: SyncDocument;
      payload: ResultsFile | SessionConfig | null;
      patchId: string;
      user: string;
    };

export type ServerMessage =
  | { type: "pong" }
  | { type: "snapshot"; snapshot: RoomSnapshot }
  | {
      type: "patch";
      document: SyncDocument;
      payload: ResultsFile | SessionConfig | null;
      patchId: string;
      user: string;
      revision: number;
      appliedAt: string;
    }
  | { type: "error"; message: string };

export function parseClientMessage(raw: string): ClientMessage | null {
  try {
    const data = JSON.parse(raw) as ClientMessage;
    if (data.type === "ping") return data;
    if (
      data.type === "patch" &&
      (data.document === "results" || data.document === "session") &&
      typeof data.patchId === "string" &&
      data.patchId.length > 0
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

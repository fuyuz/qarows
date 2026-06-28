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
      sentAt: string;
      user: string;
    };

export type ServerMessage =
  | { type: "pong" }
  | { type: "snapshot"; snapshot: RoomSnapshot }
  | {
      type: "patch";
      document: SyncDocument;
      payload: ResultsFile | SessionConfig | null;
      sentAt: string;
      user: string;
      revision: number;
    }
  | { type: "error"; message: string };

export function parseServerMessage(raw: string): ServerMessage | null {
  try {
    return JSON.parse(raw) as ServerMessage;
  } catch {
    return null;
  }
}

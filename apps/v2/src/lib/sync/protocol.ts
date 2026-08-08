import type { ResultsFile, SessionConfig, TestDefinition } from "@qarows/shared";
import { createI18n, detectLocale } from "@qarows/shared";
import type { ProjectCommand } from "@qarows/application";

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

export function parseServerMessage(raw: string): ServerMessage | null {
  try {
    return JSON.parse(raw) as ServerMessage;
  } catch {
    return null;
  }
}

export class SyncSendError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "SyncSendError";
  }
}

export function getSnapshotReplacedMessage(): string {
  return createI18n(detectLocale()).t("sync.yamlReplaced");
}

/** @deprecated Use getSnapshotReplacedMessage() for locale-aware text */
export const SNAPSHOT_REPLACED_MESSAGE = getSnapshotReplacedMessage();

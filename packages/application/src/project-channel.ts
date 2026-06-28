import type { ProjectCommand } from "./project-command";
import type { ConnectionState } from "./connection-state";
import type { ProjectSnapshot } from "./types";

export type ProjectEvent =
  | { type: "snapshot"; snapshot: ProjectSnapshot; revision: number }
  | {
      type: "commandApplied";
      command: ProjectCommand;
      snapshot: ProjectSnapshot;
      revision: number;
      commandId: string;
    }
  | { type: "connectionState"; state: ConnectionState }
  | { type: "error"; message: string };

export interface ProjectChannelHandlers {
  onEvent?: (event: ProjectEvent) => void;
}

export interface CommandEnvelope {
  commandId: string;
  command: ProjectCommand;
  user?: string;
}

export interface ProjectChannel {
  connect(projectId: string, handlers: ProjectChannelHandlers): void;
  disconnect(): void;
  send(envelope: CommandEnvelope): Promise<void>;
  getConnectionState(): ConnectionState;
}

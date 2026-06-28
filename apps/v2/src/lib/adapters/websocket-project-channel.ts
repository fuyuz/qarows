import {
  projectSnapshotFromRoom,
  IDLE_CONNECTION,
  type ConnectionState,
  type CommandEnvelope,
  type ConnectionStatus,
  type ProjectChannel,
  type ProjectChannelHandlers,
  type ProjectSnapshot,
} from "@qarows/application";
import { ProjectSyncClient } from "@/lib/sync/project-sync-client";

export class WebSocketProjectChannel implements ProjectChannel {
  private readonly client = new ProjectSyncClient();
  private projectId: string | null = null;
  private snapshot: ProjectSnapshot | null = null;
  private handlers: ProjectChannelHandlers | null = null;
  private revision = 0;
  private pendingCommands = 0;
  private connectionStatus: ConnectionStatus = "idle";
  private defaultUser = "";

  setUser(user: string): void {
    this.defaultUser = user;
  }

  connect(projectId: string, handlers: ProjectChannelHandlers): void {
    this.projectId = projectId;
    this.handlers = handlers;
    this.connectionStatus = "connecting";
    this.emitConnectionState();

    this.client.connect(projectId, this.defaultUser, {
      onOpen: () => {
        this.connectionStatus = "connected";
        this.emitConnectionState();
      },
      onClose: () => {
        this.connectionStatus = "reconnecting";
        this.emitConnectionState();
      },
      onSnapshot: (room) => {
        this.snapshot = projectSnapshotFromRoom(projectId, room);
        this.revision = room.revision;
        this.handlers?.onEvent?.({
          type: "snapshot",
          snapshot: this.snapshot,
          revision: this.revision,
        });
        this.emitConnectionState();
      },
      onCommandApplied: (message) => {
        this.snapshot = projectSnapshotFromRoom(projectId, message.snapshot);
        this.revision = message.revision;
        this.handlers?.onEvent?.({
          type: "commandApplied",
          command: message.command,
          snapshot: this.snapshot,
          revision: message.revision,
          commandId: message.commandId,
        });
        this.emitConnectionState();
      },
      onError: (message) => {
        this.handlers?.onEvent?.({ type: "error", message });
      },
    });
  }

  disconnect(): void {
    this.client.disconnect();
    this.projectId = null;
    this.snapshot = null;
    this.revision = 0;
    this.pendingCommands = 0;
    this.connectionStatus = "idle";
    this.handlers = null;
  }

  getConnectionState(): ConnectionState {
    if (!this.projectId) return IDLE_CONNECTION;
    return {
      status: this.connectionStatus,
      revision: this.revision,
      pendingCommands: this.pendingCommands,
    };
  }

  getSnapshot(): ProjectSnapshot | null {
    return this.snapshot;
  }

  async send(envelope: CommandEnvelope): Promise<void> {
    this.pendingCommands += 1;
    this.emitConnectionState();
    try {
      await this.client.command(
        envelope.command,
        envelope.commandId,
        envelope.user ?? this.defaultUser,
      );
    } finally {
      this.pendingCommands = Math.max(0, this.pendingCommands - 1);
      this.emitConnectionState();
    }
  }

  private emitConnectionState(): void {
    this.handlers?.onEvent?.({
      type: "connectionState",
      state: this.getConnectionState(),
    });
  }
}

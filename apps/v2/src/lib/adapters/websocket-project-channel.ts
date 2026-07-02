import {
  applyProjectCommand,
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
  private actor = "";

  connect(projectId: string, handlers: ProjectChannelHandlers): void {
    this.projectId = projectId;
    this.handlers = handlers;
    this.connectionStatus = "connecting";
    this.emitConnectionState();

    this.client.connect(projectId, {
      onOpen: () => {
        this.connectionStatus = "connected";
        this.emitConnectionState();
      },
      onClose: () => {
        this.connectionStatus = "reconnecting";
        this.emitConnectionState();
      },
      onSnapshot: (room) => {
        this.applyRoomSnapshot(projectId, room);
        this.handlers?.onEvent?.({
          type: "snapshot",
          snapshot: this.snapshot!,
          revision: this.revision,
        });
        this.emitConnectionState();
      },
      onSnapshotReplaced: (message) => {
        this.applyRoomSnapshot(projectId, message.snapshot);
        this.handlers?.onEvent?.({
          type: "snapshotReplaced",
          snapshot: this.snapshot!,
          revision: message.revision,
          generation: message.generation,
        });
        this.emitConnectionState();
      },
      onCommandApplied: (message) => {
        this.applyRoomSnapshot(projectId, message.snapshot);
        this.handlers?.onEvent?.({
          type: "commandApplied",
          command: message.command,
          snapshot: this.snapshot!,
          revision: message.revision,
          commandId: message.commandId,
        });
        this.emitConnectionState();
      },
      onCommandRejected: (message) => {
        this.applyRoomSnapshot(projectId, message.snapshot);
        this.handlers?.onEvent?.({
          type: "snapshotReplaced",
          snapshot: this.snapshot!,
          revision: message.snapshot.revision,
          generation: message.snapshot.generation,
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

  setActor(actor: string): void {
    this.actor = actor.trim();
  }

  async send(envelope: CommandEnvelope): Promise<void> {
    this.applyOptimistic(envelope);

    this.pendingCommands += 1;
    this.emitConnectionState();
    try {
      await this.client.command(envelope.command, envelope.commandId);
    } finally {
      this.pendingCommands = Math.max(0, this.pendingCommands - 1);
      this.emitConnectionState();
    }
  }

  private applyOptimistic(envelope: CommandEnvelope): void {
    if (!this.snapshot || !this.handlers) return;

    try {
      const { snapshot: next } = applyProjectCommand(this.snapshot, envelope.command, {
        actor: this.actor || undefined,
      });
      this.snapshot = next;
      this.handlers.onEvent?.({
        type: "commandApplied",
        command: envelope.command,
        snapshot: next,
        revision: this.revision,
        commandId: envelope.commandId,
      });
    } catch {
      // Server remains authoritative; invalid optimistic commands are dropped locally.
    }
  }

  private applyRoomSnapshot(
    projectId: string,
    room: {
      revision: number;
      definition: ProjectSnapshot["definition"];
      results: ProjectSnapshot["results"];
      session: ProjectSnapshot["session"];
    },
  ): void {
    this.snapshot = projectSnapshotFromRoom(projectId, room);
    this.revision = room.revision;
  }

  private emitConnectionState(): void {
    this.handlers?.onEvent?.({
      type: "connectionState",
      state: this.getConnectionState(),
    });
  }
}

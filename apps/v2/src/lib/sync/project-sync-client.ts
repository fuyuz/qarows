import type { ProjectCommand } from "@qarows/application";
import {
  parseServerMessage,
  SNAPSHOT_REPLACED_MESSAGE,
  SyncSendError,
  type ClientMessage,
  type RoomSnapshot,
} from "./protocol";

export interface ProjectSyncHandlers {
  onOpen?: () => void;
  onClose?: () => void;
  onSnapshot: (snapshot: RoomSnapshot) => void;
  onSnapshotReplaced: (message: {
    generation: string;
    revision: number;
    snapshot: RoomSnapshot;
  }) => void;
  onCommandApplied: (message: {
    command: ProjectCommand;
    commandId: string;
    user: string;
    revision: number;
    appliedAt: string;
    snapshot: RoomSnapshot;
  }) => void;
  onCommandRejected?: (message: {
    commandId: string;
    reason: "generation_mismatch";
    snapshot: RoomSnapshot;
  }) => void;
  onError: (message: string) => void;
}

const COMMAND_ACK_TIMEOUT_MS = 15_000;
const RECONNECT_BASE_MS = 500;
const RECONNECT_MAX_MS = 10_000;
const PING_INTERVAL_MS = 30_000;

interface PendingCommand {
  resolve: () => void;
  reject: (error: Error) => void;
  timeoutId: ReturnType<typeof setTimeout>;
}

interface QueuedCommand {
  command: ProjectCommand;
  commandId: string;
  user: string;
  inFlight: boolean;
}

export class ProjectSyncClient {
  private ws: WebSocket | null = null;
  private pingTimer: ReturnType<typeof setInterval> | null = null;
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  private projectId = "";
  private handlers: ProjectSyncHandlers | null = null;
  private intentionalClose = false;
  private reconnectAttempt = 0;
  private snapshotReceived = false;
  private generation = "";
  private readonly pendingCommands = new Map<string, PendingCommand>();
  private readonly outboundQueue: QueuedCommand[] = [];
  private readonly abandonedCommandIds = new Set<string>();

  connect(projectId: string, _user: string, handlers: ProjectSyncHandlers): void {
    this.disconnect(false);
    this.intentionalClose = false;
    this.projectId = projectId;
    this.handlers = handlers;
    this.reconnectAttempt = 0;
    this.generation = "";
    this.openSocket();
  }

  disconnect(rejectPending = true): void {
    this.intentionalClose = true;
    if (this.reconnectTimer) clearTimeout(this.reconnectTimer);
    this.reconnectTimer = null;
    if (this.pingTimer) clearInterval(this.pingTimer);
    this.pingTimer = null;
    this.ws?.close();
    this.ws = null;
    this.snapshotReceived = false;
    this.generation = "";
    this.outboundQueue.length = 0;
    this.abandonedCommandIds.clear();
    if (rejectPending) {
      this.rejectAllPending(new SyncSendError("Sync client disconnected"));
    }
  }

  command(command: ProjectCommand, commandId: string, user: string): Promise<void> {
    return new Promise((resolve, reject) => {
      const timeoutId = setTimeout(() => {
        this.abandonCommand(commandId, new SyncSendError("Command acknowledgement timed out"));
      }, COMMAND_ACK_TIMEOUT_MS);

      this.pendingCommands.set(commandId, {
        resolve: () => {
          clearTimeout(timeoutId);
          resolve();
        },
        reject: (error) => {
          clearTimeout(timeoutId);
          reject(error);
        },
        timeoutId,
      });

      this.outboundQueue.push({ command, commandId, user, inFlight: false });
      this.flushOutboundQueue();
    });
  }

  private openSocket(): void {
    if (this.intentionalClose) return;

    const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
    const url = `${protocol}//${window.location.host}/api/projects/${encodeURIComponent(this.projectId)}/ws`;
    const ws = new WebSocket(url);
    this.ws = ws;

    ws.addEventListener("open", () => {
      this.reconnectAttempt = 0;
      this.snapshotReceived = false;
      this.handlers?.onOpen?.();
      this.pingTimer = setInterval(() => {
        this.sendRaw({ type: "ping" });
      }, PING_INTERVAL_MS);
    });

    ws.addEventListener("close", () => {
      if (this.pingTimer) clearInterval(this.pingTimer);
      this.pingTimer = null;
      this.ws = null;
      this.snapshotReceived = false;
      for (const queued of this.outboundQueue) {
        queued.inFlight = false;
      }
      this.handlers?.onClose?.();
      this.scheduleReconnect();
    });

    ws.addEventListener("message", (event) => {
      if (typeof event.data !== "string") return;
      const message = parseServerMessage(event.data);
      if (!message) {
        this.handlers?.onError("Invalid server message");
        return;
      }

      switch (message.type) {
        case "pong":
          return;
        case "snapshot":
          this.applyGenerationFromSnapshot(message.snapshot);
          this.snapshotReceived = true;
          this.handlers?.onSnapshot(message.snapshot);
          this.flushOutboundQueue();
          return;
        case "snapshotReplaced":
          this.applyGenerationFromSnapshot(message.snapshot);
          this.snapshotReceived = true;
          this.discardOutboundQueue(new SyncSendError(SNAPSHOT_REPLACED_MESSAGE));
          this.handlers?.onSnapshotReplaced(message);
          return;
        case "commandApplied": {
          this.applyGenerationFromSnapshot(message.snapshot);
          const abandoned = this.abandonedCommandIds.has(message.commandId);
          if (abandoned) {
            this.abandonedCommandIds.delete(message.commandId);
            this.removeQueuedCommand(message.commandId);
          }
          this.handlers?.onCommandApplied(message);
          if (!abandoned) {
            this.resolvePendingCommand(message.commandId);
          }
          return;
        }
        case "commandRejected": {
          this.applyGenerationFromSnapshot(message.snapshot);
          this.discardOutboundQueue(new SyncSendError(SNAPSHOT_REPLACED_MESSAGE));
          this.rejectPendingCommand(message.commandId, new SyncSendError(SNAPSHOT_REPLACED_MESSAGE));
          this.handlers?.onCommandRejected?.(message);
          return;
        }
        case "error":
          this.handlers?.onError(message.message);
          return;
      }
    });

    ws.addEventListener("error", () => {
      this.handlers?.onError("WebSocket connection error");
    });
  }

  private applyGenerationFromSnapshot(snapshot: RoomSnapshot): void {
    this.generation = snapshot.generation;
  }

  private discardOutboundQueue(rejectError: SyncSendError): void {
    this.outboundQueue.length = 0;
    this.abandonedCommandIds.clear();
    this.rejectAllPending(rejectError);
  }

  private scheduleReconnect(): void {
    if (this.intentionalClose || this.reconnectTimer) return;
    const delay = Math.min(RECONNECT_BASE_MS * 2 ** this.reconnectAttempt, RECONNECT_MAX_MS);
    this.reconnectAttempt += 1;
    this.reconnectTimer = setTimeout(() => {
      this.reconnectTimer = null;
      this.openSocket();
    }, delay);
  }

  private flushOutboundQueue(): void {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN || !this.snapshotReceived) return;
    if (!this.generation) return;

    for (const queued of this.outboundQueue) {
      if (queued.inFlight || this.abandonedCommandIds.has(queued.commandId)) continue;
      const sent = this.sendRaw({
        type: "command",
        generation: this.generation,
        command: queued.command,
        commandId: queued.commandId,
        user: queued.user,
      });
      if (!sent) break;
      queued.inFlight = true;
    }
  }

  private sendRaw(message: ClientMessage): boolean {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
      return false;
    }
    this.ws.send(JSON.stringify(message));
    return true;
  }

  private resolvePendingCommand(commandId: string): void {
    this.removeQueuedCommand(commandId);

    const pending = this.pendingCommands.get(commandId);
    if (!pending) return;

    this.pendingCommands.delete(commandId);
    pending.resolve();
    this.flushOutboundQueue();
  }

  private rejectPendingCommand(commandId: string, error: Error): void {
    this.removeQueuedCommand(commandId);
    const pending = this.pendingCommands.get(commandId);
    if (!pending) return;
    this.pendingCommands.delete(commandId);
    pending.reject(error);
  }

  private abandonCommand(commandId: string, error: Error): void {
    this.abandonedCommandIds.add(commandId);
    this.removeQueuedCommand(commandId);
    const pending = this.pendingCommands.get(commandId);
    if (!pending) return;
    this.pendingCommands.delete(commandId);
    pending.reject(error);
  }

  private removeQueuedCommand(commandId: string): void {
    const index = this.outboundQueue.findIndex((queued) => queued.commandId === commandId);
    if (index >= 0) {
      this.outboundQueue.splice(index, 1);
    }
  }

  private rejectAllPending(error: Error): void {
    for (const pending of this.pendingCommands.values()) {
      pending.reject(error);
    }
    this.pendingCommands.clear();
  }
}

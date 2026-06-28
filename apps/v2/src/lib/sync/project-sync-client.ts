import type { ResultsFile, SessionConfig } from "@qarows/shared";
import {
  parseServerMessage,
  SyncSendError,
  type ClientMessage,
  type RoomSnapshot,
  type SyncDocument,
} from "./protocol";

export interface ProjectSyncHandlers {
  onOpen?: () => void;
  onClose?: () => void;
  onSnapshot: (snapshot: RoomSnapshot) => void;
  onPatch: (
    document: SyncDocument,
    payload: ResultsFile | SessionConfig | null,
    revision: number,
  ) => void;
  onError: (message: string) => void;
}

const PATCH_ACK_TIMEOUT_MS = 15_000;
const RECONNECT_BASE_MS = 500;
const RECONNECT_MAX_MS = 10_000;
const PING_INTERVAL_MS = 30_000;

interface PendingPatch {
  resolve: () => void;
  reject: (error: Error) => void;
  timeoutId: ReturnType<typeof setTimeout>;
}

interface QueuedPatch {
  document: SyncDocument;
  payload: ResultsFile | SessionConfig | null;
  patchId: string;
  user: string;
  inFlight: boolean;
}

function createPatchId(): string {
  return crypto.randomUUID();
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
  private readonly pendingPatches = new Map<string, PendingPatch>();
  private readonly outboundQueue: QueuedPatch[] = [];
  private readonly abandonedPatchIds = new Set<string>();

  connect(projectId: string, _user: string, handlers: ProjectSyncHandlers): void {
    this.disconnect(false);
    this.intentionalClose = false;
    this.projectId = projectId;
    this.handlers = handlers;
    this.reconnectAttempt = 0;
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
    this.outboundQueue.length = 0;
    this.abandonedPatchIds.clear();
    if (rejectPending) {
      this.rejectAllPending(new SyncSendError("Sync client disconnected"));
    }
  }

  patch(
    document: SyncDocument,
    payload: ResultsFile | SessionConfig | null,
    user: string,
  ): Promise<void> {
    const patchId = createPatchId();

    return new Promise((resolve, reject) => {
      const timeoutId = setTimeout(() => {
        this.abandonPatch(patchId, new SyncSendError("Patch acknowledgement timed out"));
      }, PATCH_ACK_TIMEOUT_MS);

      this.pendingPatches.set(patchId, {
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

      this.outboundQueue.push({ document, payload, patchId, user, inFlight: false });
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
          this.snapshotReceived = true;
          this.handlers?.onSnapshot(message.snapshot);
          this.flushOutboundQueue();
          return;
        case "patch": {
          const abandoned = this.abandonedPatchIds.has(message.patchId);
          if (abandoned) {
            this.abandonedPatchIds.delete(message.patchId);
            this.removeQueuedPatch(message.patchId);
          }
          this.handlers?.onPatch(message.document, message.payload, message.revision);
          if (!abandoned) {
            this.resolvePendingPatch(message.patchId);
          }
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

    for (const queued of this.outboundQueue) {
      if (queued.inFlight || this.abandonedPatchIds.has(queued.patchId)) continue;
      const sent = this.sendRaw({
        type: "patch",
        document: queued.document,
        payload: queued.payload,
        patchId: queued.patchId,
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

  private resolvePendingPatch(patchId: string): void {
    this.removeQueuedPatch(patchId);

    const pending = this.pendingPatches.get(patchId);
    if (!pending) return;

    this.pendingPatches.delete(patchId);
    pending.resolve();
    this.flushOutboundQueue();
  }

  private abandonPatch(patchId: string, error: Error): void {
    this.abandonedPatchIds.add(patchId);
    this.removeQueuedPatch(patchId);
    const pending = this.pendingPatches.get(patchId);
    if (!pending) return;
    this.pendingPatches.delete(patchId);
    pending.reject(error);
  }

  private removeQueuedPatch(patchId: string): void {
    const index = this.outboundQueue.findIndex((queued) => queued.patchId === patchId);
    if (index >= 0) {
      this.outboundQueue.splice(index, 1);
    }
  }

  private rejectAllPending(error: Error): void {
    for (const pending of this.pendingPatches.values()) {
      pending.reject(error);
    }
    this.pendingPatches.clear();
  }
}

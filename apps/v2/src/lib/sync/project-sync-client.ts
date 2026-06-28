import type { ResultsFile, SessionConfig } from "@qarows/shared";
import { parseServerMessage, type RoomSnapshot, type SyncDocument } from "./protocol";

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

export class ProjectSyncClient {
  private ws: WebSocket | null = null;
  private pingTimer: ReturnType<typeof setInterval> | null = null;

  connect(projectId: string, user: string, handlers: ProjectSyncHandlers): void {
    this.disconnect();

    const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
    const url = `${protocol}//${window.location.host}/api/projects/${encodeURIComponent(projectId)}/ws`;
    const ws = new WebSocket(url);
    this.ws = ws;

    ws.addEventListener("open", () => {
      handlers.onOpen?.();
      this.pingTimer = setInterval(() => {
        this.send({ type: "ping" });
      }, 30_000);
    });

    ws.addEventListener("close", () => {
      if (this.pingTimer) clearInterval(this.pingTimer);
      this.pingTimer = null;
      handlers.onClose?.();
    });

    ws.addEventListener("message", (event) => {
      if (typeof event.data !== "string") return;
      const message = parseServerMessage(event.data);
      if (!message) {
        handlers.onError("Invalid server message");
        return;
      }

      switch (message.type) {
        case "pong":
          return;
        case "snapshot":
          handlers.onSnapshot(message.snapshot);
          return;
        case "patch":
          handlers.onPatch(message.document, message.payload, message.revision);
          return;
        case "error":
          handlers.onError(message.message);
          return;
      }
    });

    ws.addEventListener("error", () => {
      handlers.onError("WebSocket connection error");
    });

    void user;
  }

  disconnect(): void {
    if (this.pingTimer) clearInterval(this.pingTimer);
    this.pingTimer = null;
    this.ws?.close();
    this.ws = null;
  }

  patch(
    document: SyncDocument,
    payload: ResultsFile | SessionConfig | null,
    user: string,
  ): void {
    this.send({
      type: "patch",
      document,
      payload,
      sentAt: new Date().toISOString(),
      user,
    });
  }

  private send(message: unknown): void {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) return;
    this.ws.send(JSON.stringify(message));
  }
}

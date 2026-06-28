import { DurableObject } from "cloudflare:workers";
import type { ResultsFile, SessionConfig } from "@qarows/shared";
import { getProject, snapshotToPersisted, updateProjectSnapshot } from "./db";
import type { Env } from "./env";
import { parseClientMessage, send, type RoomSnapshot } from "./sync-protocol";

interface StoredRoomState extends RoomSnapshot {
  lastWriteAt: Record<"results" | "session", string>;
}

export class ProjectRoom extends DurableObject<Env> {
  private projectId: string | null = null;
  private state: StoredRoomState | null = null;

  async initFromD1(): Promise<void> {
    await this.ensureLoaded();
  }

  override async fetch(request: Request): Promise<Response> {
    const url = new URL(request.url);
    const segments = url.pathname.split("/").filter(Boolean);
    const projectId = segments[2] ?? null;
    if (!projectId) return new Response("Missing project id", { status: 400 });

    this.projectId = projectId;

    if (request.headers.get("Upgrade") !== "websocket") {
      return new Response("Expected WebSocket", { status: 426 });
    }

    await this.ensureLoaded();
    if (!this.state) return new Response("Project not found", { status: 404 });

    const pair = new WebSocketPair();
    const [client, server] = Object.values(pair);
    this.ctx.acceptWebSocket(server);
    send(server, { type: "snapshot", snapshot: this.publicSnapshot() });
    return new Response(null, { status: 101, webSocket: client });
  }

  override async webSocketMessage(ws: WebSocket, message: string | ArrayBuffer): Promise<void> {
    if (typeof message !== "string") return;
    const parsed = parseClientMessage(message);
    if (!parsed) {
      send(ws, { type: "error", message: "Invalid message" });
      return;
    }

    if (parsed.type === "ping") {
      send(ws, { type: "pong" });
      return;
    }

    await this.ensureLoaded();
    if (!this.state || !this.projectId) {
      send(ws, { type: "error", message: "Room not ready" });
      return;
    }

    const accepted = await this.applyPatch(parsed.document, parsed.payload, parsed.sentAt, parsed.user);
    if (!accepted) return;

    const broadcast: Parameters<typeof send>[1] = {
      type: "patch",
      document: parsed.document,
      payload: parsed.payload,
      sentAt: parsed.sentAt,
      user: parsed.user,
      revision: this.state.revision,
    };

    for (const socket of this.ctx.getWebSockets()) {
      send(socket, broadcast);
    }

    await this.persistToD1();
  }

  private publicSnapshot(): RoomSnapshot {
    const state = this.state!;
    return {
      revision: state.revision,
      definition: state.definition,
      results: state.results,
      session: state.session,
    };
  }

  private async ensureLoaded(): Promise<void> {
    if (this.state) return;

    const cached = await this.ctx.storage.get<StoredRoomState>("state");
    if (cached) {
      this.state = cached;
      if (!this.projectId) this.projectId = cached.definition.project.id ?? null;
      return;
    }

    if (!this.projectId) return;

    const snapshot = await getProject(this.env.DB, this.projectId);
    if (!snapshot) return;

    const updatedAt = snapshot.updatedAt;
    this.state = {
      revision: 0,
      definition: snapshot.definition,
      results: snapshot.results,
      session: snapshot.session,
      lastWriteAt: {
        results: updatedAt,
        session: updatedAt,
      },
    };
    await this.ctx.storage.put("state", this.state);
  }

  private async applyPatch(
    document: "results" | "session",
    payload: ResultsFile | SessionConfig | null,
    sentAt: string,
    user: string,
  ): Promise<boolean> {
    const state = this.state!;
    if (sentAt < state.lastWriteAt[document]) {
      return false;
    }

    state.revision += 1;
    state.lastWriteAt[document] = sentAt;

    if (document === "results") {
      state.results = payload as ResultsFile;
    } else {
      state.session = payload as SessionConfig | null;
    }

    await this.ctx.storage.put("state", state);
    void user;
    return true;
  }

  private async persistToD1(): Promise<void> {
    if (!this.state || !this.projectId) return;
    const { testsYaml, resultsJson, session, updatedAt } = snapshotToPersisted({
      definition: this.state.definition,
      results: this.state.results,
      session: this.state.session,
      updatedAt: new Date().toISOString(),
    });
    await updateProjectSnapshot(this.env.DB, this.projectId, {
      testsYaml,
      resultsJson,
      session,
      updatedAt,
    });
  }
}

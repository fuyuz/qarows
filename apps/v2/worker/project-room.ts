import { DurableObject } from "cloudflare:workers";
import type { ResultsFile, SessionConfig } from "@qarows/shared";
import { getProject, snapshotToPersisted, updateProjectSnapshot } from "./db";
import { AccessDeniedError, requireAuthUser } from "./auth";
import type { Env } from "./env";
import { parseClientMessage, send, type RoomSnapshot } from "./sync-protocol";

interface StoredRoomState extends RoomSnapshot {}

export class ProjectRoom extends DurableObject<Env> {
  private projectId: string | null = null;
  private state: StoredRoomState | null = null;

  async initFromD1(): Promise<void> {
    this.state = null;
    await this.ensureLoaded(true);
  }

  override async fetch(request: Request): Promise<Response> {
    try {
      requireAuthUser(request, this.env);
    } catch (err) {
      const message = err instanceof AccessDeniedError ? err.message : "Unauthorized";
      return new Response(message, { status: 401 });
    }

    const url = new URL(request.url);
    const segments = url.pathname.split("/").filter(Boolean);
    const projectId = segments[2] ?? null;
    if (!projectId) return new Response("Missing project id", { status: 400 });

    this.projectId = projectId;

    if (request.method === "DELETE") {
      await this.destroyRoom();
      return Response.json({ ok: true });
    }

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

    const applied = await this.applyPatch(parsed.document, parsed.payload, parsed.user);
    const appliedAt = new Date().toISOString();

    const broadcast: Parameters<typeof send>[1] = {
      type: "patch",
      document: parsed.document,
      payload: parsed.payload,
      patchId: parsed.patchId,
      user: parsed.user,
      revision: applied.revision,
      appliedAt,
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

  private async ensureLoaded(forceFromD1 = false): Promise<void> {
    if (this.state && !forceFromD1) return;

    if (!forceFromD1) {
      const cached = await this.ctx.storage.get<StoredRoomState>("state");
      if (cached) {
        this.state = cached;
        if (!this.projectId) this.projectId = cached.definition.project.id ?? null;
        return;
      }
    }

    if (!this.projectId) return;

    const snapshot = await getProject(this.env.DB, this.projectId);
    if (!snapshot) {
      this.state = null;
      return;
    }

    this.state = {
      revision: 0,
      definition: snapshot.definition,
      results: snapshot.results,
      session: snapshot.session,
    };
    await this.ctx.storage.put("state", this.state);
  }

  private async applyPatch(
    document: "results" | "session",
    payload: ResultsFile | SessionConfig | null,
    user: string,
  ): Promise<{ revision: number }> {
    const state = this.state!;
    state.revision += 1;

    if (document === "results") {
      state.results = payload as ResultsFile;
    } else {
      state.session = payload as SessionConfig | null;
    }

    await this.ctx.storage.put("state", state);
    void user;
    return { revision: state.revision };
  }

  private async destroyRoom(): Promise<void> {
    for (const socket of this.ctx.getWebSockets()) {
      socket.close(1012, "Project deleted");
    }
    await this.ctx.storage.deleteAll();
    this.state = null;
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

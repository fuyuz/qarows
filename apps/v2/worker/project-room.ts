import { DurableObject } from "cloudflare:workers";
import { applyProjectCommand, toProjectSnapshot, type ProjectCommand } from "@qarows/application";
import { getProject, snapshotToPersisted, updateProjectSnapshot } from "./db";
import { AccessDeniedError, requireAuthUser } from "./auth";
import type { Env } from "./env";
import {
  parseClientMessage,
  send,
  SYNC_PING_MESSAGE,
  SYNC_PONG_MESSAGE,
  type RoomSnapshot,
} from "./sync-protocol";

interface StoredRoomState extends RoomSnapshot {}

interface ProcessedCommandRecord {
  revision: number;
  user: string;
}

interface ApplyCommandResult {
  revision: number;
  duplicate: boolean;
  user: string;
}

const MAX_PROCESSED_COMMANDS = 256;
const PROCESSED_COMMANDS_KEY = "processedCommands";

export class ProjectRoom extends DurableObject<Env> {
  private projectId: string | null = null;
  private state: StoredRoomState | null = null;

  constructor(ctx: DurableObjectState, env: Env) {
    super(ctx, env);
    this.ctx.setWebSocketAutoResponse(
      new WebSocketRequestResponsePair(SYNC_PING_MESSAGE, SYNC_PONG_MESSAGE),
    );
  }

  async initFromD1(): Promise<void> {
    this.state = null;
    await this.ensureLoaded(true);
  }

  /** Worker-internal RPC: clear room state without HTTP auth headers. */
  async destroy(): Promise<void> {
    await this.destroyRoom();
  }

  override async fetch(request: Request): Promise<Response> {
    try {
      await requireAuthUser(request, this.env);
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
      return;
    }

    await this.ensureLoaded();
    if (!this.state || !this.projectId) {
      send(ws, { type: "error", message: "Room not ready" });
      return;
    }

    let applied: ApplyCommandResult;
    try {
      applied = await this.applyCommand(parsed.commandId, parsed.command, parsed.user);
    } catch (err) {
      const messageText = err instanceof Error ? err.message : "Command failed";
      send(ws, { type: "error", message: messageText });
      return;
    }

    const appliedAt = new Date().toISOString();
    const broadcast: Parameters<typeof send>[1] = {
      type: "commandApplied",
      command: parsed.command,
      commandId: parsed.commandId,
      user: applied.user,
      revision: applied.revision,
      appliedAt,
      snapshot: this.publicSnapshot(),
    };

    for (const socket of this.ctx.getWebSockets()) {
      send(socket, broadcast);
    }

    if (!applied.duplicate) {
      try {
        await this.persistToD1();
      } catch (err) {
        console.error(
          JSON.stringify({
            level: "error",
            message: "D1 persist failed after command broadcast",
            projectId: this.projectId,
            revision: applied.revision,
            commandId: parsed.commandId,
            error: err instanceof Error ? err.message : String(err),
          }),
        );
        send(ws, { type: "error", message: "変更の永続化に失敗しました" });
      }
    }
  }

  override async webSocketClose(
    ws: WebSocket,
    code: number,
    reason: string,
    _wasClean: boolean,
  ): Promise<void> {
    ws.close(code, reason);
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

  private async loadProcessedCommands(): Promise<Map<string, ProcessedCommandRecord>> {
    const raw = await this.ctx.storage.get<Record<string, ProcessedCommandRecord>>(
      PROCESSED_COMMANDS_KEY,
    );
    return new Map(Object.entries(raw ?? {}));
  }

  private async saveProcessedCommands(map: Map<string, ProcessedCommandRecord>): Promise<void> {
    while (map.size > MAX_PROCESSED_COMMANDS) {
      const oldest = map.keys().next().value;
      if (!oldest) break;
      map.delete(oldest);
    }
    await this.ctx.storage.put(PROCESSED_COMMANDS_KEY, Object.fromEntries(map));
  }

  private async applyCommand(
    commandId: string,
    command: ProjectCommand,
    user: string,
  ): Promise<ApplyCommandResult> {
    const processed = await this.loadProcessedCommands();
    const existing = processed.get(commandId);
    if (existing) {
      return {
        revision: existing.revision,
        duplicate: true,
        user: existing.user,
      };
    }

    const state = this.state!;
    const projectId = this.projectId!;
    const snapshot = toProjectSnapshot(projectId, {
      definition: state.definition,
      results: state.results,
      session: state.session,
      updatedAt: state.results.updatedAt,
    });

    const { snapshot: next } = applyProjectCommand(snapshot, command);
    state.revision += 1;
    state.definition = next.definition;
    state.results = next.results;
    state.session = next.session;

    await this.ctx.storage.put("state", state);

    processed.set(commandId, {
      revision: state.revision,
      user,
    });
    await this.saveProcessedCommands(processed);

    return {
      revision: state.revision,
      duplicate: false,
      user,
    };
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

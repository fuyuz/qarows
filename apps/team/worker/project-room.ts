import { DurableObject } from "cloudflare:workers";
import { applyProjectCommand, toProjectSnapshot, type ProjectCommand } from "@qarows/application";
import {
  createI18n,
  DEFAULT_LOCALE,
  parseAcceptLanguage,
  type Locale,
  type ResultsFile,
} from "@qarows/shared";
import { getProject, replaceProjectDefinition, snapshotToProjectColumns, updateProjectSnapshot } from "./db";
import { assertGenerationMatch } from "./merge-results";
import { AccessDeniedError, assertWebSocketOrigin, requireAuthUser } from "./auth";
import type { Env } from "./env";
import {
  exceedsMaxWsMessageBytes,
  parseClientMessage,
  send,
  SYNC_PING_MESSAGE,
  SYNC_PONG_MESSAGE,
  type RoomSnapshot,
} from "./sync-protocol";
import { persistThenBroadcast } from "./room-sync";
import { hasValidRoomGeneration, resolveProjectIdFromRoomCache } from "./room-load";

interface StoredRoomState extends RoomSnapshot {
  /**
   * definition が D1 の tests_yaml に未反映（updateTestCase 等）。
   * DO storage に載せてハイバネーションを跨がせる。
   * 省略はこのフラグ導入前のレガシー状態で、反映済みとして扱う。
   * 導入前は毎コマンド YAML を書いていたため未反映のまま残るのは永続化失敗時だけで、
   * 逆に未反映扱いにすると未編集プロジェクトの整形を初回入力で壊してしまう
   */
  definitionDirty?: boolean;
}

interface ProcessedCommandRecord {
  revision: number;
  user: string;
  /** 省略はレガシー記録（appliedAt 導入前） */
  appliedAt?: string;
  /** false = D1 永続化未完了。省略はレガシー記録（永続化済みとみなす） */
  persisted?: boolean;
}

interface ApplyCommandResult {
  revision: number;
  duplicate: boolean;
  user: string;
  appliedAt: string;
  persisted: boolean;
}

interface SocketAttachment {
  user: string;
  locale: Locale;
}

function getSocketAttachment(ws: WebSocket): SocketAttachment | null {
  return ws.deserializeAttachment() as SocketAttachment | null;
}

function getSocketUser(ws: WebSocket): string | null {
  return getSocketAttachment(ws)?.user ?? null;
}

const MAX_PROCESSED_COMMANDS = 256;
const PROCESSED_COMMANDS_KEY = "processedCommands";

function isCommandPersisted(record: ProcessedCommandRecord): boolean {
  return record.persisted !== false;
}

function getSocketI18n(ws: WebSocket) {
  const locale = getSocketAttachment(ws)?.locale ?? DEFAULT_LOCALE;
  return createI18n(locale);
}

export class ProjectRoom extends DurableObject<Env> {
  private projectId: string | null = null;
  private state: StoredRoomState | null = null;

  constructor(ctx: DurableObjectState, env: Env) {
    super(ctx, env);
    this.ctx.setWebSocketAutoResponse(
      new WebSocketRequestResponsePair(SYNC_PING_MESSAGE, SYNC_PONG_MESSAGE),
    );
  }

  async initFromD1(projectId: string): Promise<void> {
    this.projectId = projectId;
    this.state = null;
    await this.ensureLoaded(true);
  }

  /** Worker-internal RPC: clear room state without HTTP auth headers. */
  async destroy(): Promise<void> {
    await this.destroyRoom();
  }

  /** Worker-internal RPC: replace tests.yml in-place (D1 → DO → broadcast). */
  async replaceProjectFromWorker(body: {
    projectId: string;
    testsYaml: string;
    mergeIncoming?: ResultsFile;
    expectedGeneration?: string;
  }): Promise<RoomSnapshot> {
    this.projectId = body.projectId;
    await this.ensureLoaded();
    if (!this.state || !this.projectId) {
      throw new Error("Project not found");
    }

    if (body.expectedGeneration !== undefined) {
      assertGenerationMatch(body.expectedGeneration, this.state.generation);
    }

    const snapshot = await replaceProjectDefinition(this.env.DB, this.projectId, body.testsYaml, {
      mergeIncoming: body.mergeIncoming,
    });
    if (!snapshot) {
      throw new Error("Project not found");
    }

    this.state = {
      generation: snapshot.generation,
      revision: 0,
      definition: snapshot.definition,
      results: snapshot.results,
      session: snapshot.session,
      definitionDirty: false,
    };
    await this.ctx.storage.put("state", this.state);
    await this.ctx.storage.delete(PROCESSED_COMMANDS_KEY);

    const publicSnap = this.publicSnapshot();
    const replaced: Parameters<typeof send>[1] = {
      type: "snapshotReplaced",
      generation: publicSnap.generation,
      revision: 0,
      snapshot: publicSnap,
    };
    for (const socket of this.ctx.getWebSockets()) {
      send(socket, replaced);
    }

    return publicSnap;
  }

  override async fetch(request: Request): Promise<Response> {
    const url = new URL(request.url);
    const acceptLanguage =
      request.headers.get("Accept-Language") ?? url.searchParams.get("accept-language");
    const locale = parseAcceptLanguage(acceptLanguage);
    const { t } = createI18n(locale);

    let authUser;
    try {
      authUser = await requireAuthUser(request, this.env);
    } catch (err) {
      const message = err instanceof AccessDeniedError ? err.message : t("api.unauthorized");
      return new Response(message, { status: 401 });
    }

    const segments = url.pathname.split("/").filter(Boolean);
    const projectId = segments[2] ?? null;
    if (!projectId) return new Response(t("api.missingProjectId"), { status: 400 });

    this.projectId = projectId;

    if (request.headers.get("Upgrade") !== "websocket") {
      return new Response(t("api.expectedWebSocket"), { status: 426 });
    }

    try {
      assertWebSocketOrigin(request, this.env);
    } catch (err) {
      const message = err instanceof AccessDeniedError ? err.message : t("api.forbidden");
      return new Response(message, { status: 403 });
    }

    await this.ensureLoaded();
    if (!this.state) return new Response(t("api.projectNotFound"), { status: 404 });

    const pair = new WebSocketPair();
    const [client, server] = Object.values(pair);
    server.serializeAttachment({ user: authUser.email, locale } satisfies SocketAttachment);
    this.ctx.acceptWebSocket(server);
    send(server, { type: "snapshot", snapshot: this.publicSnapshot() });
    return new Response(null, { status: 101, webSocket: client });
  }

  override async webSocketMessage(ws: WebSocket, message: string | ArrayBuffer): Promise<void> {
    const { t } = getSocketI18n(ws);

    if (typeof message !== "string") return;
    // 汎用の invalid ではなく専用メッセージを返すため、parse より前に見る
    if (exceedsMaxWsMessageBytes(message)) {
      send(ws, { type: "error", message: t("api.wsMessageTooLarge") });
      return;
    }

    const user = getSocketUser(ws);
    if (!user) {
      send(ws, { type: "error", message: t("api.unauthorized") });
      ws.close(1008, "Unauthorized");
      return;
    }

    const parsed = parseClientMessage(message);
    if (!parsed) {
      send(ws, { type: "error", message: t("api.wsInvalidMessage") });
      return;
    }
    if (parsed.type === "ping") {
      return;
    }

    await this.ensureLoaded();
    if (!this.state || !this.projectId) {
      send(ws, { type: "error", message: t("api.wsRoomNotReady") });
      return;
    }

    if (parsed.type === "resync") {
      send(ws, { type: "snapshot", snapshot: this.publicSnapshot() });
      return;
    }

    if (parsed.generation !== this.state.generation) {
      send(ws, {
        type: "commandRejected",
        commandId: parsed.commandId,
        reason: "generation_mismatch",
        snapshot: this.publicSnapshot(),
      });
      return;
    }

    let applied: ApplyCommandResult;
    try {
      applied = await this.applyCommandAndSync(parsed.commandId, parsed.command, user);
    } catch (err) {
      console.error("WebSocket command failed", err);
      send(ws, { type: "error", message: t("api.wsCommandFailed") });
      return;
    }

    if (applied.duplicate) {
      return;
    }
  }

  /** Worker-internal RPC: apply a command, broadcast to clients, and persist. */
  async applyCommandFromWorker(body: {
    projectId: string;
    expectedGeneration?: string;
    commandId: string;
    command: ProjectCommand;
    user: string;
  }): Promise<{ revision: number; duplicate: boolean }> {
    this.projectId = body.projectId;
    await this.ensureLoaded();
    if (!this.state || !this.projectId) {
      throw new Error("Project not found");
    }

    if (body.expectedGeneration !== undefined) {
      assertGenerationMatch(body.expectedGeneration, this.state.generation);
    }

    const applied = await this.applyCommandAndSync(body.commandId, body.command, body.user);
    return { revision: applied.revision, duplicate: applied.duplicate };
  }

  private async broadcastCommandApplied(
    commandId: string,
    command: ProjectCommand,
    applied: ApplyCommandResult,
  ): Promise<void> {
    const broadcast: Parameters<typeof send>[1] = {
      type: "commandApplied",
      command,
      commandId,
      user: applied.user,
      revision: applied.revision,
      appliedAt: applied.appliedAt,
    };

    for (const socket of this.ctx.getWebSockets()) {
      send(socket, broadcast);
    }
  }

  private async applyCommandAndSync(
    commandId: string,
    command: ProjectCommand,
    user: string,
  ): Promise<ApplyCommandResult> {
    const applied = await this.applyCommand(commandId, command, user);
    await persistThenBroadcast({
      duplicate: applied.duplicate,
      persisted: applied.persisted,
      persist: async () => {
        await this.persistToD1();
        await this.markCommandPersisted(commandId);
      },
      broadcast: () => this.broadcastCommandApplied(commandId, command, applied),
    });
    return applied;
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
      generation: state.generation,
      revision: state.revision,
      definition: state.definition,
      results: state.results,
      session: state.session,
    };
  }

  private hasValidGeneration(state: StoredRoomState | null | undefined): boolean {
    return hasValidRoomGeneration(state);
  }

  private async ensureLoaded(forceFromD1 = false): Promise<void> {
    if (this.state && this.hasValidGeneration(this.state) && !forceFromD1) return;

    if (!forceFromD1) {
      const cached = await this.ctx.storage.get<StoredRoomState>("state");
      if (cached) {
        this.projectId = resolveProjectIdFromRoomCache(cached, this.projectId);
        if (this.hasValidGeneration(cached)) {
          this.state = cached;
          return;
        }
      }
    }

    if (!this.projectId) return;

    const snapshot = await getProject(this.env.DB, this.projectId);
    if (!snapshot) {
      this.state = null;
      return;
    }

    this.state = {
      generation: snapshot.generation,
      revision: 0,
      definition: snapshot.definition,
      results: snapshot.results,
      session: snapshot.session,
      definitionDirty: false,
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

  private async markCommandPersisted(commandId: string): Promise<void> {
    const processed = await this.loadProcessedCommands();
    const record = processed.get(commandId);
    if (!record || record.persisted === true) return;
    processed.set(commandId, { ...record, persisted: true });
    await this.saveProcessedCommands(processed);
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
        appliedAt: existing.appliedAt ?? new Date().toISOString(),
        persisted: isCommandPersisted(existing),
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

    // now を appliedAt に固定: クライアントが同じ actor/now で差分再適用しても同一状態になる
    const appliedAt = new Date().toISOString();
    const { snapshot: next, definitionChanged } = applyProjectCommand(snapshot, command, {
      actor: user,
      now: appliedAt,
    });
    state.revision += 1;
    if (definitionChanged) state.definitionDirty = true;
    state.definition = next.definition;
    state.results = next.results;
    state.session = next.session;

    await this.ctx.storage.put("state", state);

    processed.set(commandId, {
      revision: state.revision,
      user,
      appliedAt,
      persisted: false,
    });
    await this.saveProcessedCommands(processed);

    return {
      revision: state.revision,
      duplicate: false,
      user,
      appliedAt,
      persisted: false,
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
    const definitionDirty = this.state.definitionDirty === true;
    const persisted = snapshotToProjectColumns(
      {
        definition: this.state.definition,
        results: this.state.results,
        session: this.state.session,
        updatedAt: new Date().toISOString(),
      },
      { includeTestsYaml: definitionDirty },
    );
    const serialized = this.state.definition;
    await updateProjectSnapshot(this.env.DB, this.projectId, persisted);
    // D1 の await 中に別コマンドが定義を変えていたら未反映のまま残す
    if (definitionDirty && this.state?.definition === serialized) {
      this.state.definitionDirty = false;
      await this.ctx.storage.put("state", this.state);
    }
  }
}

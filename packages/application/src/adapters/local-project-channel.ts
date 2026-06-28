import { applyProjectCommand } from "../apply-project-command";
import type {
  CommandEnvelope,
  ProjectChannel,
  ProjectChannelHandlers,
} from "../project-channel";
import { LOCAL_CONNECTED, IDLE_CONNECTION, type ConnectionState } from "../connection-state";
import type { ProjectSnapshot } from "../types";

export interface LocalProjectChannelOptions {
  /** コマンド適用後に永続化 */
  onPersist?: (snapshot: ProjectSnapshot) => Promise<void>;
}

/**
 * Phase1 用 Channel。他クライアントへの broadcast はなく、直列キュー + ローカル適用のみ。
 */
export class LocalProjectChannel implements ProjectChannel {
  private projectId: string | null = null;
  private snapshot: ProjectSnapshot | null = null;
  private revision = 0;
  private handlers: ProjectChannelHandlers | null = null;
  private tail: Promise<void> = Promise.resolve();
  private readonly onPersist: ((snapshot: ProjectSnapshot) => Promise<void>) | undefined;

  constructor(options: LocalProjectChannelOptions = {}) {
    this.onPersist = options.onPersist;
  }

  connect(projectId: string, handlers: ProjectChannelHandlers): void {
    this.projectId = projectId;
    this.handlers = handlers;
    handlers.onEvent?.({ type: "connectionState", state: this.getConnectionState() });
  }

  disconnect(): void {
    this.projectId = null;
    this.snapshot = null;
    this.revision = 0;
    this.handlers = null;
    this.tail = Promise.resolve();
  }

  getConnectionState(): ConnectionState {
    if (!this.projectId) return IDLE_CONNECTION;
    return { ...LOCAL_CONNECTED, revision: this.revision };
  }

  /** 初回ロード時に snapshot をセットし snapshot イベントを発火 */
  loadSnapshot(snapshot: ProjectSnapshot, revision = 0): void {
    this.snapshot = snapshot;
    this.revision = revision;
    this.handlers?.onEvent?.({
      type: "snapshot",
      snapshot,
      revision,
    });
    this.handlers?.onEvent?.({ type: "connectionState", state: this.getConnectionState() });
  }

  getSnapshot(): ProjectSnapshot | null {
    return this.snapshot;
  }

  send(envelope: CommandEnvelope): Promise<void> {
    const run = this.tail.then(() => this.applyEnvelope(envelope));
    this.tail = run.then(
      () => undefined,
      () => undefined,
    );
    return run;
  }

  private async applyEnvelope(envelope: CommandEnvelope): Promise<void> {
    if (!this.snapshot) {
      throw new Error("LocalProjectChannel: snapshot not loaded");
    }

    try {
      const { snapshot: next, affectedTestCaseId: _affected } = applyProjectCommand(
        this.snapshot,
        envelope.command,
      );
      this.snapshot = next;
      this.revision += 1;

      if (this.onPersist) {
        await this.onPersist(next);
      }

      this.handlers?.onEvent?.({
        type: "commandApplied",
        command: envelope.command,
        snapshot: next,
        revision: this.revision,
        commandId: envelope.commandId,
      });
      this.handlers?.onEvent?.({ type: "connectionState", state: this.getConnectionState() });
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      this.handlers?.onEvent?.({ type: "error", message });
      throw err;
    }
  }
}

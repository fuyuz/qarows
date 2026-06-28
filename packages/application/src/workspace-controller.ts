import type { ProjectCommand } from "./project-command";
import type { ProjectEvent } from "./project-channel";
import type { ProjectRepository } from "./project-repository";
import type { ProjectChannel, CommandEnvelope } from "./project-channel";
import type { ProjectSnapshot, ProjectSummary } from "./types";
import { summaryFromSnapshot, sortProjectSummaries } from "./snapshot";

export interface WorkspaceControllerOptions {
  repository: ProjectRepository;
  channel: ProjectChannel;
}

/**
 * Application 層のファサード。Repository（CRUD）と Channel（作業中の更新）を束ねる。
 */
export class WorkspaceController {
  private readonly repository: ProjectRepository;
  private readonly channel: ProjectChannel;
  private activeProjectId: string | null = null;
  private snapshot: ProjectSnapshot | null = null;
  private revision = 0;
  private eventHandlers = new Set<(event: ProjectEvent) => void>();

  constructor(options: WorkspaceControllerOptions) {
    this.repository = options.repository;
    this.channel = options.channel;
  }

  subscribe(handler: (event: ProjectEvent) => void): () => void {
    this.eventHandlers.add(handler);
    return () => this.eventHandlers.delete(handler);
  }

  private emit(event: ProjectEvent): void {
    for (const handler of this.eventHandlers) {
      handler(event);
    }
  }

  getActiveProjectId(): string | null {
    return this.activeProjectId;
  }

  getSnapshot(): ProjectSnapshot | null {
    return this.snapshot;
  }

  getRevision(): number {
    return this.revision;
  }

  async listSummaries(): Promise<ProjectSummary[]> {
    return sortProjectSummaries(await this.repository.listSummaries());
  }

  async hasProject(projectId: string): Promise<boolean> {
    return this.repository.hasProject(projectId);
  }

  async activateProject(projectId: string): Promise<boolean> {
    const loaded = await this.repository.getSnapshot(projectId);
    if (!loaded) return false;

    this.activeProjectId = projectId;
    this.snapshot = loaded;
    this.revision = 0;

    this.channel.connect(projectId, {
      onEvent: (event) => this.handleChannelEvent(event),
    });

    if ("loadSnapshot" in this.channel && typeof this.channel.loadSnapshot === "function") {
      (this.channel as { loadSnapshot: (s: ProjectSnapshot, r?: number) => void }).loadSnapshot(
        loaded,
        0,
      );
    } else {
      this.emit({ type: "snapshot", snapshot: loaded, revision: 0 });
    }

    return true;
  }

  deactivateProject(): void {
    this.channel.disconnect();
    this.activeProjectId = null;
    this.snapshot = null;
    this.revision = 0;
  }

  async saveSnapshot(snapshot: ProjectSnapshot): Promise<void> {
    await this.repository.saveSnapshot(snapshot);
    this.snapshot = snapshot;
    if (this.activeProjectId === snapshot.id) {
      this.emit({ type: "snapshot", snapshot, revision: this.revision });
    }
  }

  async deleteProject(projectId: string): Promise<void> {
    await this.repository.deleteProject(projectId);
    if (this.activeProjectId === projectId) {
      this.deactivateProject();
    }
  }

  async dispatch(command: ProjectCommand, commandId?: string): Promise<ProjectSnapshot> {
    if (!this.activeProjectId) {
      throw new Error("アクティブなプロジェクトがありません");
    }

    const envelope: CommandEnvelope = {
      commandId: commandId ?? crypto.randomUUID(),
      command,
    };

    await this.channel.send(envelope);

    const snapshot = this.getSnapshotFromChannel();
    if (!snapshot) {
      throw new Error("コマンド適用後の snapshot がありません");
    }
    return snapshot;
  }

  private getSnapshotFromChannel(): ProjectSnapshot | null {
    if ("getSnapshot" in this.channel && typeof this.channel.getSnapshot === "function") {
      return (this.channel as { getSnapshot: () => ProjectSnapshot | null }).getSnapshot();
    }
    return this.snapshot;
  }

  private handleChannelEvent(event: ProjectEvent): void {
    if (event.type === "snapshot" || event.type === "commandApplied") {
      this.snapshot = event.snapshot;
      this.revision = event.revision;
    }
    this.emit(event);
  }

  /** 一覧用 summary を現在の snapshot から生成 */
  currentSummary(): ProjectSummary | null {
    return this.snapshot ? summaryFromSnapshot(this.snapshot) : null;
  }
}

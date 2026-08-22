import type { ProjectSnapshot, ProjectSummary } from "./types";

export interface CreateProjectInput {
  name: string;
  definitionYaml?: string;
}

/** プロジェクトの読み出しと削除。Phase ごとに実装が異なる */
export interface ProjectRepository {
  listSummaries(): Promise<ProjectSummary[]>;
  getSnapshot(projectId: string): Promise<ProjectSnapshot | null>;
  deleteProject(projectId: string): Promise<void>;
  hasProject(projectId: string): Promise<boolean>;
}

/**
 * snapshot を丸ごと書き戻せる Repository。
 * Team 版は定義を HTTP、結果を WebSocket command で更新するため実装しない。
 * 「書けない実装が saveSnapshot を黙って捨てる」を型で防ぐために読み出し側と分けている
 */
export interface WritableProjectRepository extends ProjectRepository {
  saveSnapshot(snapshot: ProjectSnapshot): Promise<void>;
}

export function isWritableProjectRepository(
  repository: ProjectRepository,
): repository is WritableProjectRepository {
  return typeof (repository as Partial<WritableProjectRepository>).saveSnapshot === "function";
}

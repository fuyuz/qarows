import type { ProjectSnapshot, ProjectSummary } from "./types";

export interface CreateProjectInput {
  name: string;
  definitionYaml?: string;
}

/** プロジェクト CRUD（永続化）。Phase ごとに実装が異なる */
export interface ProjectRepository {
  listSummaries(): Promise<ProjectSummary[]>;
  getSnapshot(projectId: string): Promise<ProjectSnapshot | null>;
  saveSnapshot(snapshot: ProjectSnapshot): Promise<void>;
  deleteProject(projectId: string): Promise<void>;
  hasProject(projectId: string): Promise<boolean>;
}

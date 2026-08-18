import {
  type ProjectRepository,
  type ProjectSnapshot,
  type ProjectSummary,
  normalizeProjectSummary,
  snapshotToPersisted,
  toProjectSnapshot,
} from "@qarows/application";
import { buildProjectRecord } from "@/lib/project-record";
import {
  deleteProjectFromStorage,
  getProject,
  hasProject,
  listProjectSummaries,
  saveProject,
} from "@/lib/storage";

export class IndexedDbProjectRepository implements ProjectRepository {
  async listSummaries(): Promise<ProjectSummary[]> {
    const summaries = await listProjectSummaries();
    return summaries.map((summary) =>
      normalizeProjectSummary({
        id: summary.projectId,
        name: summary.name,
        updatedAt: summary.updatedAt,
        hasValidSession: summary.hasValidSession,
      }),
    );
  }

  async getSnapshot(projectId: string): Promise<ProjectSnapshot | null> {
    const record = await getProject(projectId);
    if (!record) return null;
    return toProjectSnapshot(projectId, record);
  }

  async saveSnapshot(snapshot: ProjectSnapshot): Promise<void> {
    const persisted = snapshotToPersisted(snapshot);
    const record = buildProjectRecord(persisted, snapshot.updatedAt);
    await saveProject(snapshot.id, record);
  }

  async deleteProject(projectId: string): Promise<void> {
    await deleteProjectFromStorage(projectId);
  }

  async hasProject(projectId: string): Promise<boolean> {
    return hasProject(projectId);
  }
}

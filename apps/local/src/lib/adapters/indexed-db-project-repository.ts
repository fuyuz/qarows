import {
  type ProjectSnapshot,
  type ProjectSummary,
  type WritableProjectRepository,
  toProjectSnapshot,
} from "@qarows/application";
import { buildProjectRecord } from "@/lib/project-record";
import {
  deleteProjectFromStorage,
  getAppMeta,
  getProject,
  hasProject,
  listProjectSummaries,
  saveAppMeta,
  saveProject,
} from "@/lib/storage";

export class IndexedDbProjectRepository implements WritableProjectRepository {
  async listSummaries(): Promise<ProjectSummary[]> {
    return listProjectSummaries();
  }

  async getSnapshot(projectId: string): Promise<ProjectSnapshot | null> {
    const record = await getProject(projectId);
    if (!record) return null;
    return toProjectSnapshot(projectId, record);
  }

  async saveSnapshot(snapshot: ProjectSnapshot): Promise<void> {
    await saveProject(snapshot.id, buildProjectRecord(snapshot, snapshot.updatedAt));
  }

  async deleteProject(projectId: string): Promise<void> {
    await deleteProjectFromStorage(projectId);
  }

  async hasProject(projectId: string): Promise<boolean> {
    return hasProject(projectId);
  }

  /** 最後に開いたプロジェクト。IndexedDB の meta ストアに持つ Local 版固有の状態 */
  async getLastOpenedProjectId(): Promise<string | null> {
    return (await getAppMeta()).lastOpenedProjectId;
  }

  async setLastOpenedProjectId(projectId: string | null): Promise<void> {
    await saveAppMeta({ lastOpenedProjectId: projectId });
  }
}

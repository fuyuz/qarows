import {
  projectSnapshotFromRoom,
  type ProjectRepository,
  type ProjectSnapshot,
  type ProjectSummary,
} from "@qarows/application";
import {
  deleteProject,
  getProject,
  listProjects,
  type ProjectSnapshot as ApiProjectSnapshot,
} from "@/lib/api/projects";
import { ApiError } from "@/lib/api/client";

function apiSnapshotToApplication(snapshot: ApiProjectSnapshot): ProjectSnapshot {
  return projectSnapshotFromRoom(
    snapshot.id,
    {
      definition: snapshot.definition,
      results: snapshot.results,
      session: snapshot.session,
    },
    snapshot.updatedAt,
    snapshot.createdAt,
  );
}

/** 定義更新は PUT /definition + WebSocket snapshotReplaced が担うため saveSnapshot は持たない */
export class HttpProjectRepository implements ProjectRepository {
  async listSummaries(): Promise<ProjectSummary[]> {
    const projects = await listProjects();
    return projects.map((project) => ({
      id: project.id,
      name: project.name,
      updatedAt: project.updatedAt,
      createdAt: project.createdAt,
    }));
  }

  async getSnapshot(projectId: string): Promise<ProjectSnapshot | null> {
    try {
      return apiSnapshotToApplication(await getProject(projectId));
    } catch (err) {
      if (err instanceof ApiError && err.status === 404) {
        return null;
      }
      throw err;
    }
  }

  async deleteProject(projectId: string): Promise<void> {
    await deleteProject(projectId);
  }

  async hasProject(projectId: string): Promise<boolean> {
    const snapshot = await this.getSnapshot(projectId);
    return snapshot != null;
  }
}

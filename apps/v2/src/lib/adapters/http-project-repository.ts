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
    } catch {
      return null;
    }
  }

  async saveSnapshot(snapshot: ProjectSnapshot): Promise<void> {
    // Phase2 の definition 更新は PUT /definition + WebSocket snapshotReplaced。
    void snapshot;
  }

  async deleteProject(projectId: string): Promise<void> {
    await deleteProject(projectId);
  }

  async hasProject(projectId: string): Promise<boolean> {
    const snapshot = await this.getSnapshot(projectId);
    return snapshot != null;
  }
}

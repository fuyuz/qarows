import type { ResultsFile, SessionConfig, TestDefinition } from "@qarows/shared";
import { ApiError, apiJson } from "./client";

export interface ProjectSummary {
  id: string;
  name: string;
  updatedAt: string;
  createdAt: string;
}

export interface ProjectSnapshot {
  id: string;
  name: string;
  definition: TestDefinition;
  results: ResultsFile;
  session: SessionConfig | null;
  updatedAt: string;
  createdAt: string;
}

interface ListProjectsResponse {
  projects: ProjectSummary[];
}

interface ProjectResponse {
  project: ProjectSnapshot;
}

export async function listProjects(): Promise<ProjectSummary[]> {
  const data = await apiJson<ListProjectsResponse>("/api/projects");
  return data.projects;
}

export async function getProject(projectId: string): Promise<ProjectSnapshot> {
  const data = await apiJson<ProjectResponse>(`/api/projects/${encodeURIComponent(projectId)}`);
  return data.project;
}

export async function createProjectFromYaml(testsYaml: string): Promise<ProjectSnapshot> {
  const data = await apiJson<ProjectResponse>("/api/projects", {
    method: "POST",
    headers: { "Content-Type": "text/yaml; charset=utf-8" },
    body: testsYaml,
  });
  return data.project;
}

export async function createEmptyProject(name: string): Promise<ProjectSnapshot> {
  const data = await apiJson<ProjectResponse>("/api/projects", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ name }),
  });
  return data.project;
}

export async function deleteProject(projectId: string): Promise<void> {
  await apiJson<{ ok: true }>(`/api/projects/${encodeURIComponent(projectId)}`, {
    method: "DELETE",
  });
}

export async function clearProjectResults(projectId: string): Promise<void> {
  await apiJson<{ ok: true }>(`/api/projects/${encodeURIComponent(projectId)}/clear-results`, {
    method: "POST",
  });
}

export async function replaceProjectFromYaml(
  projectId: string,
  testsYaml: string,
): Promise<ProjectSnapshot> {
  try {
    return await createProjectFromYaml(testsYaml);
  } catch (err) {
    if (err instanceof ApiError && err.status === 409) {
      await deleteProject(projectId);
      return createProjectFromYaml(testsYaml);
    }
    throw err;
  }
}

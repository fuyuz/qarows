export type ProjectPage = "session" | "run" | "matrix" | "dashboard" | "bugs";

export const NEW_PROJECT_SELECTION = "_new";

export function projectsHubPath(projectSelection?: string | null): string {
  if (!projectSelection) return "/projects";
  return `/projects?project=${encodeURIComponent(projectSelection)}`;
}

export function projectPath(projectId: string, page: ProjectPage = "session"): string {
  return `/p/${encodeURIComponent(projectId)}/${page}`;
}

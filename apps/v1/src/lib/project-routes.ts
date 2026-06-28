import type { RunnerFilters, TestDefinition } from "@qarows/shared";
import { runnerFiltersToSearchParams } from "@/lib/runner-query";

export type ProjectPage = "session" | "run" | "matrix" | "dashboard" | "bugs";

/** Query value for the new-project import panel on /projects. */
export const NEW_PROJECT_SELECTION = "_new";

export function projectsHubPath(projectSelection?: string | null): string {
  if (!projectSelection) return "/projects";
  return `/projects?project=${encodeURIComponent(projectSelection)}`;
}

export function resolveProjectId(
  definition: TestDefinition | null | undefined,
  routeProjectId?: string,
): string | null {
  return routeProjectId ?? definition?.project.id ?? "project";
}

/** Whether runner URL query (filters, test, bug) may be inherited from the current location. */
export function inheritsRunnerQueryFromLocation(
  locationProjectId: string | null,
  targetProjectId: string,
): boolean {
  return locationProjectId === targetProjectId;
}

export function projectPath(
  projectId: string,
  page: ProjectPage,
  filters?: RunnerFilters,
  testId?: string | null,
  bugId?: string | null,
): string {
  const params = runnerFiltersToSearchParams(filters, testId, bugId);
  const search = params.toString();
  const base = `/p/${encodeURIComponent(projectId)}/${page}`;
  return search ? `${base}?${search}` : base;
}

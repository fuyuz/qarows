import type { RunnerFilters, TestDefinition } from "@qarows/shared";
import { runnerFiltersToSearchParams } from "@/lib/runner-query";

export type ProjectPage = "session" | "run" | "matrix" | "dashboard" | "bugs";

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

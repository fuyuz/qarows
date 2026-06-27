import type { RunnerFilters, TestDefinition } from "@qarows/shared";
import { runnerFiltersToSearchParams } from "@/lib/runner-query";

export type ProjectPage = "session" | "run" | "matrix" | "dashboard";

export function resolveProjectId(
  definition: TestDefinition | null | undefined,
  routeProjectId?: string,
): string | null {
  return routeProjectId ?? definition?.project.id ?? "project";
}

export function projectPath(
  projectId: string,
  page: ProjectPage,
  filters?: RunnerFilters,
  testId?: string | null,
): string {
  const params = runnerFiltersToSearchParams(filters, testId);
  const search = params.toString();
  const base = `/p/${encodeURIComponent(projectId)}/${page}`;
  return search ? `${base}?${search}` : base;
}

import type { RunnerFilters, TestDefinition } from "@qarows/shared";
import type { WorkspaceProjectPage } from "@qarows/ui";
import { runnerFiltersToSearchParams } from "./runner-query";

/** @qarows/ui のナビゲーション定義を単一の出典にする（頁を増やしたときに片方だけ漏れないように） */
export type ProjectPage = WorkspaceProjectPage;

/** Query value for the new-project import panel on /projects. */
export const NEW_PROJECT_SELECTION = "_new";

export function projectsHubPath(projectSelection?: string | null): string {
  if (!projectSelection) return "/projects";
  return `/projects?project=${encodeURIComponent(projectSelection)}`;
}

export function resolveProjectId(
  definition: TestDefinition | null | undefined,
  routeProjectId?: string,
): string {
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

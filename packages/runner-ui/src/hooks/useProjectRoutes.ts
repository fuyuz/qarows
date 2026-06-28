import { useCallback } from "react";
import { useLocation, useParams } from "react-router-dom";
import type { RunnerFilters } from "@qarows/shared";
import { useRunnerWorkspace } from "../context/runner-workspace";
import {
  inheritsRunnerQueryFromLocation,
  projectIdFromPathname,
  projectPath,
  resolveProjectId,
  type ProjectPage,
} from "../lib/project-routes";
import { parseRunnerSearchParams } from "../lib/runner-query";

export function useProjectRoutes() {
  const { definition } = useRunnerWorkspace();
  const { projectId: routeProjectId } = useParams();
  const location = useLocation();
  const loadedProjectId = definition ? resolveProjectId(definition) : null;
  const projectId = routeProjectId ?? loadedProjectId;
  const locationProjectId = projectIdFromPathname(location.pathname);

  const path = useCallback(
    (page: ProjectPage, filters?: RunnerFilters, testId?: string | null, bugId?: string | null) => {
      if (!definition && !routeProjectId) return "/projects";

      const id = resolveProjectId(definition, routeProjectId) ?? "project";
      const onProjectRoute = location.pathname.startsWith("/p/");
      const sameProject = inheritsRunnerQueryFromLocation(locationProjectId, id);

      let resolvedFilters = filters;
      let resolvedTestId = testId;
      let resolvedBugId = bugId;

      const inheritsRunnerQuery = page === "run" || page === "matrix" || page === "bugs";

      if (resolvedFilters === undefined && onProjectRoute && inheritsRunnerQuery && sameProject) {
        resolvedFilters = parseRunnerSearchParams(new URLSearchParams(location.search)).filters;
      }

      if (resolvedTestId === undefined && onProjectRoute && page === "run" && sameProject) {
        resolvedTestId = new URLSearchParams(location.search).get("test");
      }

      if (resolvedBugId === undefined && onProjectRoute && page === "bugs" && sameProject) {
        resolvedBugId = new URLSearchParams(location.search).get("bug");
      }

      if (resolvedTestId === undefined) {
        resolvedTestId = null;
      }

      if (resolvedBugId === undefined) {
        resolvedBugId = null;
      }

      return projectPath(id, page, resolvedFilters, resolvedTestId, resolvedBugId);
    },
    [definition, location.pathname, location.search, locationProjectId, routeProjectId],
  );

  return { projectId, loadedProjectId, path };
}

import { useCallback } from "react";
import { useLocation, useParams } from "react-router-dom";
import type { RunnerFilters } from "@qarows/shared";
import { useApp } from "@/context/AppContext";
import { projectPath, resolveProjectId, type ProjectPage } from "@/lib/project-routes";
import { parseRunnerSearchParams } from "@/lib/runner-query";

export function useProjectRoutes() {
  const { definition } = useApp();
  const { projectId: routeProjectId } = useParams();
  const location = useLocation();
  const loadedProjectId = definition ? resolveProjectId(definition) : null;
  const projectId = routeProjectId ?? loadedProjectId;

  const path = useCallback(
    (page: ProjectPage, filters?: RunnerFilters, testId?: string | null) => {
      if (!definition && !routeProjectId) return "/load";

      const id = resolveProjectId(definition, routeProjectId) ?? "project";
      const onProjectRoute = location.pathname.startsWith("/p/");

      let resolvedFilters = filters;
      let resolvedTestId = testId;

      const inheritsRunnerQuery = page === "run" || page === "matrix";

      if (resolvedFilters === undefined && onProjectRoute && inheritsRunnerQuery) {
        resolvedFilters = parseRunnerSearchParams(new URLSearchParams(location.search)).filters;
      }

      if (resolvedTestId === undefined && onProjectRoute && page === "run") {
        resolvedTestId = new URLSearchParams(location.search).get("test");
      }

      if (resolvedTestId === undefined) {
        resolvedTestId = null;
      }

      return projectPath(id, page, resolvedFilters, resolvedTestId);
    },
    [definition, location.pathname, location.search, routeProjectId],
  );

  return { projectId, loadedProjectId, path };
}

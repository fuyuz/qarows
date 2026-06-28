import { useCallback } from "react";
import { useParams } from "react-router-dom";
import type { ProjectPage } from "@/lib/project-routes";
import { projectPath } from "@/lib/project-routes";
import { useProjectSync } from "@/context/ProjectSyncContext";

export function useProjectRoutes() {
  const { projectId: routeProjectId, page } = useParams<{ projectId: string; page: ProjectPage }>();
  const { definition } = useProjectSync();
  const projectId = routeProjectId ?? definition?.project.id ?? null;

  const path = useCallback(
    (nextPage: ProjectPage) => {
      if (!projectId) return "/projects";
      return projectPath(projectId, nextPage);
    },
    [projectId],
  );

  return { projectId, page, path };
}

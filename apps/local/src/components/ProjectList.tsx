import { ProjectListShell, type ProjectListItem } from "@qarows/ui";
import { useApp } from "@/context/AppContext";
import { useProjectsQueryState } from "@/hooks/useProjectsQueryState";
import { NEW_PROJECT_SELECTION } from "@/lib/project-routes";

export function ProjectList() {
  const { projectSummaries, lastOpenedProjectId } = useApp();
  const { projectId, setProjectId } = useProjectsQueryState();

  const summaries: ProjectListItem[] = projectSummaries.map((summary) => ({
    id: summary.projectId,
    name: summary.name,
    updatedAt: summary.updatedAt,
    hasValidSession: summary.hasValidSession,
  }));

  return (
    <ProjectListShell
      summaries={summaries}
      selectedId={projectId}
      lastOpenedProjectId={lastOpenedProjectId}
      newProjectSelectionId={NEW_PROJECT_SELECTION}
      onSelect={(nextProjectId) => void setProjectId(nextProjectId)}
      showSessionBadge
    />
  );
}

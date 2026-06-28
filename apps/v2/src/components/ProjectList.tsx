import { ProjectListShell, type ProjectListItem } from "@qarows/ui";
import { useProjects } from "@/context/ProjectsContext";
import { useProjectsQueryState } from "@/hooks/useProjectsQueryState";
import { NEW_PROJECT_SELECTION } from "@/lib/project-routes";

export function ProjectList() {
  const { projectSummaries, lastOpenedProjectId } = useProjects();
  const { projectId, setProjectId } = useProjectsQueryState();

  const summaries: ProjectListItem[] = projectSummaries.map((summary) => ({
    id: summary.id,
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
      showSessionBadge={false}
    />
  );
}

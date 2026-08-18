import { isValidSession } from "@qarows/shared";
import type { ProjectRecord, ProjectSummary } from "@/lib/storage";

export function projectRecordToSummary(projectId: string, record: ProjectRecord): ProjectSummary {
  return {
    projectId,
    name: record.definition.project.name,
    updatedAt: record.updatedAt,
    hasValidSession: record.session != null && isValidSession(record.session),
  };
}

export function sortProjectSummaries(summaries: ProjectSummary[]): ProjectSummary[] {
  return [...summaries].sort(
    (a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime(),
  );
}

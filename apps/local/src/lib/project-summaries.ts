import { summaryFromSnapshot, toProjectSnapshot, type ProjectSummary } from "@qarows/application";
import type { ProjectRecord } from "@/lib/storage";

export function projectRecordToSummary(projectId: string, record: ProjectRecord): ProjectSummary {
  return summaryFromSnapshot(toProjectSnapshot(projectId, record));
}

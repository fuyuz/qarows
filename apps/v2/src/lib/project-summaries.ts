import type { ProjectSummary } from "@/lib/api/projects";

export function sortProjectSummaries(summaries: ProjectSummary[]): ProjectSummary[] {
  return [...summaries].sort(
    (a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime(),
  );
}

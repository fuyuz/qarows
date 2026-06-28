import type { ResultsFile, SessionConfig, TestDefinition } from "@qarows/shared";
import type { ProjectRecord } from "@/lib/storage";

export function buildProjectRecord(
  snapshot: {
    definition: TestDefinition;
    results: ResultsFile;
    session: SessionConfig | null;
  },
  updatedAt: string = new Date().toISOString(),
): ProjectRecord {
  return {
    definition: snapshot.definition,
    results: snapshot.results,
    session: snapshot.session,
    updatedAt,
  };
}

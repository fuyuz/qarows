import { isValidSession } from "@qarows/shared";
import type { ResultsFile, SessionConfig, TestDefinition } from "@qarows/shared";
import type { ProjectSnapshot, ProjectSummary } from "./types";

/** RoomSnapshot / DO 内部 state から Application Snapshot へ */
export function projectSnapshotFromRoom(
  projectId: string,
  room: {
    definition: TestDefinition;
    results: ResultsFile;
    session: SessionConfig | null;
  },
  updatedAt?: string,
  createdAt?: string,
): ProjectSnapshot {
  return {
    id: projectId,
    name: room.definition.project.name,
    definition: room.definition,
    results: room.results,
    session: room.session,
    updatedAt: updatedAt ?? room.results.updatedAt,
    ...(createdAt ? { createdAt } : {}),
  };
}

/** Phase1 `ProjectRecord` / Phase2 D1 row から共通 Snapshot へ */
export function toProjectSnapshot(
  projectId: string,
  record: {
    definition: ProjectSnapshot["definition"];
    results: ProjectSnapshot["results"];
    session: ProjectSnapshot["session"];
    updatedAt: string;
    createdAt?: string;
  },
): ProjectSnapshot {
  return {
    id: projectId,
    name: record.definition.project.name,
    definition: record.definition,
    results: record.results,
    session: record.session,
    updatedAt: record.updatedAt,
    ...(record.createdAt ? { createdAt: record.createdAt } : {}),
  };
}

export function snapshotToPersisted(snapshot: ProjectSnapshot): {
  definition: ProjectSnapshot["definition"];
  results: ProjectSnapshot["results"];
  session: ProjectSnapshot["session"];
  updatedAt: string;
} {
  return {
    definition: snapshot.definition,
    results: snapshot.results,
    session: snapshot.session,
    updatedAt: snapshot.updatedAt,
  };
}

export function summaryFromSnapshot(snapshot: ProjectSnapshot): ProjectSummary {
  return {
    id: snapshot.id,
    name: snapshot.name,
    updatedAt: snapshot.updatedAt,
    ...(snapshot.createdAt ? { createdAt: snapshot.createdAt } : {}),
    hasValidSession: snapshot.session != null && isValidSession(snapshot.session),
  };
}

/** Phase1 の `projectId` フィールドを `id` に正規化 */
export function normalizeProjectSummary(
  summary: ProjectSummary & { projectId?: string },
): ProjectSummary {
  const id = summary.id ?? summary.projectId;
  if (!id) {
    throw new Error("ProjectSummary requires id or projectId");
  }
  const { projectId: _legacy, ...rest } = summary;
  return { ...rest, id };
}

export function sortProjectSummaries(summaries: ProjectSummary[]): ProjectSummary[] {
  return [...summaries].sort(
    (a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime(),
  );
}

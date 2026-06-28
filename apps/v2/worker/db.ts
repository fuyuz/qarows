import {
  createEmptyResults,
  getProjectIdFromDefinition,
  parseResultsJson,
  parseTestsYaml,
  serializeResultsJson,
  serializeTestsYaml,
  type ResultsFile,
  type SessionConfig,
  type TestDefinition,
} from "@qarows/shared";
import type { Env } from "./env";

export interface ProjectRow {
  id: string;
  name: string;
  tests_yaml: string;
  results_json: string;
  session_json: string | null;
  updated_at: string;
  created_at: string;
}

export interface ProjectSummary {
  id: string;
  name: string;
  updatedAt: string;
  createdAt: string;
}

export interface ProjectSnapshot {
  id: string;
  name: string;
  definition: TestDefinition;
  results: ResultsFile;
  session: SessionConfig | null;
  updatedAt: string;
  createdAt: string;
}

function rowToSnapshot(row: ProjectRow): ProjectSnapshot {
  const definition = parseTestsYaml(row.tests_yaml);
  const results = parseResultsJson(row.results_json, { definition });
  const session = row.session_json ? (JSON.parse(row.session_json) as SessionConfig) : null;
  return {
    id: row.id,
    name: row.name,
    definition,
    results,
    session,
    updatedAt: row.updated_at,
    createdAt: row.created_at,
  };
}

export async function listProjects(db: D1Database): Promise<ProjectSummary[]> {
  const result = await db
    .prepare(
      `SELECT id, name, updated_at, created_at
       FROM projects
       ORDER BY updated_at DESC`,
    )
    .all<Pick<ProjectRow, "id" | "name" | "updated_at" | "created_at">>();

  return (result.results ?? []).map((row) => ({
    id: row.id,
    name: row.name,
    updatedAt: row.updated_at,
    createdAt: row.created_at,
  }));
}

export async function getProject(db: D1Database, projectId: string): Promise<ProjectSnapshot | null> {
  const row = await db
    .prepare("SELECT * FROM projects WHERE id = ?")
    .bind(projectId)
    .first<ProjectRow>();
  if (!row) return null;
  return rowToSnapshot(row);
}

export async function insertProject(
  db: D1Database,
  input: {
    testsYaml: string;
    resultsJson?: string;
    session?: SessionConfig | null;
  },
): Promise<ProjectSnapshot> {
  const definition = parseTestsYaml(input.testsYaml);
  const projectId = getProjectIdFromDefinition(definition);
  const now = new Date().toISOString();
  const results = input.resultsJson
    ? parseResultsJson(input.resultsJson, { definition })
    : createEmptyResults(projectId);
  const sessionJson = input.session ? JSON.stringify(input.session) : null;

  await db
    .prepare(
      `INSERT INTO projects (id, name, tests_yaml, results_json, session_json, updated_at, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
    )
    .bind(
      projectId,
      definition.project.name,
      input.testsYaml,
      serializeResultsJson(results),
      sessionJson,
      now,
      now,
    )
    .run();

  return (await getProject(db, projectId))!;
}

export async function updateProjectSnapshot(
  db: D1Database,
  projectId: string,
  input: {
    testsYaml?: string;
    resultsJson?: string;
    session?: SessionConfig | null;
    updatedAt?: string;
  },
): Promise<ProjectSnapshot | null> {
  const existing = await db
    .prepare("SELECT * FROM projects WHERE id = ?")
    .bind(projectId)
    .first<ProjectRow>();
  if (!existing) return null;

  const testsYaml = input.testsYaml ?? existing.tests_yaml;
  const definition = parseTestsYaml(testsYaml);
  const resultsJson =
    input.resultsJson ??
    existing.results_json ??
    serializeResultsJson(createEmptyResults(projectId));
  const sessionJson =
    input.session !== undefined
      ? input.session
        ? JSON.stringify(input.session)
        : null
      : existing.session_json;
  const updatedAt = input.updatedAt ?? new Date().toISOString();

  await db
    .prepare(
      `UPDATE projects
       SET name = ?, tests_yaml = ?, results_json = ?, session_json = ?, updated_at = ?
       WHERE id = ?`,
    )
    .bind(
      definition.project.name,
      testsYaml,
      resultsJson,
      sessionJson,
      updatedAt,
      projectId,
    )
    .run();

  return getProject(db, projectId);
}

export async function deleteProject(db: D1Database, projectId: string): Promise<boolean> {
  const result = await db.prepare("DELETE FROM projects WHERE id = ?").bind(projectId).run();
  return (result.meta.changes ?? 0) > 0;
}

export function snapshotToPersisted(row: {
  definition: TestDefinition;
  results: ResultsFile;
  session: SessionConfig | null;
  updatedAt: string;
}): { testsYaml: string; resultsJson: string; session: SessionConfig | null; updatedAt: string } {
  return {
    testsYaml: serializeTestsYaml(row.definition),
    resultsJson: serializeResultsJson(row.results),
    session: row.session,
    updatedAt: row.updatedAt,
  };
}

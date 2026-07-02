import {
  createEmptyResults,
  getProjectIdFromDefinition,
  mergeResultsFiles,
  parseResultsJson,
  parseTestsYaml,
  reconcileResultsOnDefinitionReplace,
  serializeResultsJson,
  serializeTestsYaml,
  type ResultsFile,
  type SessionConfig,
  type TestDefinition,
} from "@qarows/shared";

export interface ProjectRow {
  id: string;
  name: string;
  tests_yaml: string;
  results_json: string;
  session_started: number;
  generation: string;
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
  generation: string;
  updatedAt: string;
  createdAt: string;
}

export class ProjectIdMismatchError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ProjectIdMismatchError";
  }
}

function resolveGeneration(projectId: string, generation: string | null | undefined): string {
  const trimmed = generation?.trim();
  if (trimmed) return trimmed;
  return `${projectId}-legacy`;
}

/** D1 は session_started のみ永続化。DO 再読込時の in-memory プレースホルダ。 */
export function sessionFromStartedFlag(sessionStarted: boolean): SessionConfig | null {
  if (!sessionStarted) return null;
  return { executorName: "", selectedEnvironmentIds: [] };
}

function rowToSnapshot(row: ProjectRow): ProjectSnapshot {
  const definition = parseTestsYaml(row.tests_yaml);
  const results = parseResultsJson(row.results_json, { definition });
  return {
    id: row.id,
    name: row.name,
    definition,
    results,
    session: sessionFromStartedFlag(row.session_started === 1),
    generation: resolveGeneration(row.id, row.generation),
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
  },
): Promise<ProjectSnapshot> {
  const definition = parseTestsYaml(input.testsYaml);
  const projectId = getProjectIdFromDefinition(definition);
  const now = new Date().toISOString();
  const generation = crypto.randomUUID();
  const results = input.resultsJson
    ? parseResultsJson(input.resultsJson, { definition })
    : createEmptyResults(projectId);

  await db
    .prepare(
      `INSERT INTO projects (id, name, tests_yaml, results_json, session_started, generation, updated_at, created_at)
       VALUES (?, ?, ?, ?, 0, ?, ?, ?)`,
    )
    .bind(
      projectId,
      definition.project.name,
      input.testsYaml,
      serializeResultsJson(results),
      generation,
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
    sessionStarted?: boolean;
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
  const sessionStarted =
    input.sessionStarted !== undefined ? (input.sessionStarted ? 1 : 0) : existing.session_started;
  const updatedAt = input.updatedAt ?? new Date().toISOString();

  await db
    .prepare(
      `UPDATE projects
       SET name = ?, tests_yaml = ?, results_json = ?, session_started = ?, updated_at = ?
       WHERE id = ?`,
    )
    .bind(
      definition.project.name,
      testsYaml,
      resultsJson,
      sessionStarted,
      updatedAt,
      projectId,
    )
    .run();

  return getProject(db, projectId);
}

/** tests.yml 置換: 既存 results を reconcile して同一行を更新 */
export async function replaceProjectDefinition(
  db: D1Database,
  projectId: string,
  testsYaml: string,
  options?: { mergeIncoming?: ResultsFile },
): Promise<ProjectSnapshot | null> {
  const existing = await db
    .prepare("SELECT * FROM projects WHERE id = ?")
    .bind(projectId)
    .first<ProjectRow>();
  if (!existing) return null;

  const definition = parseTestsYaml(testsYaml);
  const yamlProjectId = getProjectIdFromDefinition(definition);
  if (yamlProjectId !== projectId) {
    throw new ProjectIdMismatchError(
      `tests.yml project.id (${yamlProjectId}) が URL の projectId (${projectId}) と一致しません`,
    );
  }

  const current = rowToSnapshot(existing);
  let results = reconcileResultsOnDefinitionReplace(current.results, definition);
  if (options?.mergeIncoming) {
    results = mergeResultsFiles(results, options.mergeIncoming);
  }
  const generation = crypto.randomUUID();
  const updatedAt = new Date().toISOString();

  await db
    .prepare(
      `UPDATE projects
       SET name = ?, tests_yaml = ?, results_json = ?, generation = ?, updated_at = ?
       WHERE id = ?`,
    )
    .bind(
      definition.project.name,
      testsYaml,
      serializeResultsJson(results),
      generation,
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
}): {
  testsYaml: string;
  resultsJson: string;
  sessionStarted: boolean;
  updatedAt: string;
} {
  return {
    testsYaml: serializeTestsYaml(row.definition),
    resultsJson: serializeResultsJson(row.results),
    sessionStarted: row.session != null,
    updatedAt: row.updatedAt,
  };
}

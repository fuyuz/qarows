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

/**
 * 結果・セッションの更新は tests_yaml に触らない。
 * 定義が変わっていないのに再直列化すると、ユーザーがアップロードした tests.yml の
 * コメント・並び・整形が結果入力 1 件で失われる
 */
export async function updateProjectSnapshot(
  db: D1Database,
  projectId: string,
  input: {
    testsYaml?: string;
    resultsJson?: string;
    sessionStarted?: boolean;
    updatedAt?: string;
  },
): Promise<void> {
  // 結果入力ごとに tests_yaml まで読み戻さないよう、必要な列だけ引く
  const existing = await db
    .prepare("SELECT results_json, session_started FROM projects WHERE id = ?")
    .bind(projectId)
    .first<Pick<ProjectRow, "results_json" | "session_started">>();
  if (!existing) return;

  const resultsJson =
    input.resultsJson ??
    existing.results_json ??
    serializeResultsJson(createEmptyResults(projectId));
  const sessionStarted =
    input.sessionStarted !== undefined ? (input.sessionStarted ? 1 : 0) : existing.session_started;
  const updatedAt = input.updatedAt ?? new Date().toISOString();

  if (input.testsYaml === undefined) {
    await db
      .prepare(
        `UPDATE projects
         SET results_json = ?, session_started = ?, updated_at = ?
         WHERE id = ?`,
      )
      .bind(resultsJson, sessionStarted, updatedAt, projectId)
      .run();
    return;
  }

  // name は tests.yml 由来の非正規化コピーなので、YAML を書くときだけ引き直す
  const definition = parseTestsYaml(input.testsYaml);
  await db
    .prepare(
      `UPDATE projects
       SET name = ?, tests_yaml = ?, results_json = ?, session_started = ?, updated_at = ?
       WHERE id = ?`,
    )
    .bind(
      definition.project.name,
      input.testsYaml,
      resultsJson,
      sessionStarted,
      updatedAt,
      projectId,
    )
    .run();
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

const DEFINITION_REVISION_LIMIT = 20;

export interface DefinitionRevisionRow {
  id: string;
  project_id: string;
  tests_yaml: string;
  source: string;
  instruction: string | null;
  created_by: string | null;
  created_at: string;
}

export interface DefinitionRevisionSummary {
  id: string;
  source: string;
  instruction: string | null;
  createdBy: string | null;
  createdAt: string;
}

export async function insertDefinitionRevision(
  db: D1Database,
  input: {
    projectId: string;
    testsYaml: string;
    source: string;
    instruction?: string | null;
    createdBy?: string | null;
  },
): Promise<DefinitionRevisionSummary> {
  const id = crypto.randomUUID();
  const createdAt = new Date().toISOString();
  await db
    .prepare(
      `INSERT INTO definition_revisions (id, project_id, tests_yaml, source, instruction, created_by, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
    )
    .bind(
      id,
      input.projectId,
      input.testsYaml,
      input.source,
      input.instruction ?? null,
      input.createdBy ?? null,
      createdAt,
    )
    .run();

  const overflow = await db
    .prepare(
      `SELECT id FROM definition_revisions
       WHERE project_id = ?
       ORDER BY created_at DESC
       LIMIT -1 OFFSET ?`,
    )
    .bind(input.projectId, DEFINITION_REVISION_LIMIT)
    .all<{ id: string }>();

  for (const row of overflow.results ?? []) {
    await db
      .prepare("DELETE FROM definition_revisions WHERE id = ? AND project_id = ?")
      .bind(row.id, input.projectId)
      .run();
  }

  return {
    id,
    source: input.source,
    instruction: input.instruction ?? null,
    createdBy: input.createdBy ?? null,
    createdAt,
  };
}

export async function listDefinitionRevisions(
  db: D1Database,
  projectId: string,
  limit = DEFINITION_REVISION_LIMIT,
): Promise<DefinitionRevisionSummary[]> {
  const result = await db
    .prepare(
      `SELECT id, source, instruction, created_by, created_at
       FROM definition_revisions
       WHERE project_id = ?
       ORDER BY created_at DESC
       LIMIT ?`,
    )
    .bind(projectId, limit)
    .all<Pick<DefinitionRevisionRow, "id" | "source" | "instruction" | "created_by" | "created_at">>();

  return (result.results ?? []).map((row) => ({
    id: row.id,
    source: row.source,
    instruction: row.instruction,
    createdBy: row.created_by,
    createdAt: row.created_at,
  }));
}

export async function getDefinitionRevision(
  db: D1Database,
  projectId: string,
  revisionId: string,
): Promise<DefinitionRevisionRow | null> {
  return db
    .prepare("SELECT * FROM definition_revisions WHERE project_id = ? AND id = ?")
    .bind(projectId, revisionId)
    .first<DefinitionRevisionRow>();
}

/** How long an AI proposal can be applied after propose. */
export const AI_PROPOSAL_TTL_MS = 30 * 60 * 1000;
/** Max proposals retained per project (including consumed/expired until pruned). */
const AI_PROPOSAL_RETENTION = 20;

export interface AiProposalRow {
  id: string;
  project_id: string;
  proposed_yaml: string;
  base_generation: string;
  instruction: string | null;
  created_by: string | null;
  created_at: string;
  expires_at: string;
  consumed_at: string | null;
}

export interface AiProposalRecord {
  id: string;
  projectId: string;
  proposedYaml: string;
  baseGeneration: string;
  instruction: string | null;
  createdBy: string | null;
  createdAt: string;
  expiresAt: string;
  consumedAt: string | null;
}

function rowToAiProposal(row: AiProposalRow): AiProposalRecord {
  return {
    id: row.id,
    projectId: row.project_id,
    proposedYaml: row.proposed_yaml,
    baseGeneration: row.base_generation,
    instruction: row.instruction,
    createdBy: row.created_by,
    createdAt: row.created_at,
    expiresAt: row.expires_at,
    consumedAt: row.consumed_at,
  };
}

export async function insertAiProposal(
  db: D1Database,
  input: {
    projectId: string;
    proposedYaml: string;
    baseGeneration: string;
    instruction?: string | null;
    createdBy?: string | null;
    now?: Date;
  },
): Promise<AiProposalRecord> {
  const now = input.now ?? new Date();
  const id = crypto.randomUUID();
  const createdAt = now.toISOString();
  const expiresAt = new Date(now.getTime() + AI_PROPOSAL_TTL_MS).toISOString();

  await db
    .prepare(
      `INSERT INTO ai_proposals
        (id, project_id, proposed_yaml, base_generation, instruction, created_by, created_at, expires_at, consumed_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, NULL)`,
    )
    .bind(
      id,
      input.projectId,
      input.proposedYaml,
      input.baseGeneration,
      input.instruction ?? null,
      input.createdBy ?? null,
      createdAt,
      expiresAt,
    )
    .run();

  // Drop expired rows, then keep only the newest N for this project.
  await db
    .prepare(`DELETE FROM ai_proposals WHERE project_id = ? AND expires_at < ?`)
    .bind(input.projectId, createdAt)
    .run();

  const overflow = await db
    .prepare(
      `SELECT id FROM ai_proposals
       WHERE project_id = ?
       ORDER BY created_at DESC
       LIMIT -1 OFFSET ?`,
    )
    .bind(input.projectId, AI_PROPOSAL_RETENTION)
    .all<{ id: string }>();

  for (const row of overflow.results ?? []) {
    await db
      .prepare("DELETE FROM ai_proposals WHERE id = ? AND project_id = ?")
      .bind(row.id, input.projectId)
      .run();
  }

  return {
    id,
    projectId: input.projectId,
    proposedYaml: input.proposedYaml,
    baseGeneration: input.baseGeneration,
    instruction: input.instruction ?? null,
    createdBy: input.createdBy ?? null,
    createdAt,
    expiresAt,
    consumedAt: null,
  };
}

export async function getAiProposal(
  db: D1Database,
  projectId: string,
  proposalId: string,
): Promise<AiProposalRecord | null> {
  const row = await db
    .prepare("SELECT * FROM ai_proposals WHERE project_id = ? AND id = ?")
    .bind(projectId, proposalId)
    .first<AiProposalRow>();
  return row ? rowToAiProposal(row) : null;
}

export class AiProposalError extends Error {
  readonly status: 400 | 404 | 409 | 410;

  constructor(status: 400 | 404 | 409 | 410, message: string) {
    super(message);
    this.name = "AiProposalError";
    this.status = status;
  }
}

export function assertAiProposalUsable(proposal: AiProposalRecord, now = new Date()): void {
  if (proposal.consumedAt) {
    throw new AiProposalError(409, "AI proposal already applied");
  }
  if (Date.parse(proposal.expiresAt) <= now.getTime()) {
    throw new AiProposalError(410, "AI proposal expired");
  }
}

/** Load a proposal and ensure it is still usable (not consumed / not expired). */
export async function requireUsableAiProposal(
  db: D1Database,
  input: {
    projectId: string;
    proposalId: string;
    now?: Date;
  },
): Promise<AiProposalRecord> {
  const proposal = await getAiProposal(db, input.projectId, input.proposalId);
  if (!proposal) {
    throw new AiProposalError(404, "AI proposal not found");
  }
  assertAiProposalUsable(proposal, input.now ?? new Date());
  return proposal;
}

/** Mark a proposal consumed after a successful apply. */
export async function markAiProposalConsumed(
  db: D1Database,
  input: {
    projectId: string;
    proposalId: string;
    now?: Date;
  },
): Promise<void> {
  const consumedAt = (input.now ?? new Date()).toISOString();
  const result = await db
    .prepare(
      `UPDATE ai_proposals
       SET consumed_at = ?
       WHERE id = ? AND project_id = ? AND consumed_at IS NULL`,
    )
    .bind(consumedAt, input.proposalId, input.projectId)
    .run();

  if ((result.meta.changes ?? 0) === 0) {
    throw new AiProposalError(409, "AI proposal already applied");
  }
}

export function snapshotToPersisted(
  row: {
    definition: TestDefinition;
    results: ResultsFile;
    session: SessionConfig | null;
    updatedAt: string;
  },
  /** 定義が D1 と一致しているなら includeTestsYaml: false。YAML の再直列化ごと省く */
  options: { includeTestsYaml?: boolean } = {},
): {
  testsYaml?: string;
  resultsJson: string;
  sessionStarted: boolean;
  updatedAt: string;
} {
  return {
    ...(options.includeTestsYaml !== false
      ? { testsYaml: serializeTestsYaml(row.definition) }
      : {}),
    resultsJson: serializeResultsJson(row.results),
    sessionStarted: row.session != null,
    updatedAt: row.updatedAt,
  };
}

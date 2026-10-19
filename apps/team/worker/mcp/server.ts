import { McpServer } from "@modelcontextprotocol/server";
import type { ProjectCommand } from "@qarows/application";
import {
  BUG_STATUS_DISPLAY_ORDER,
  PROJECT_ID_PATTERN,
  isBugClosed,
  isResultEntryValid,
  nextBugId,
  resolveTestTargets,
  serializeTestsYaml,
  type Bug,
  type TestCase,
  type TestDefinition,
} from "@qarows/shared";
import { HTTPException } from "hono/http-exception";
import { z } from "zod";
import type { AuthUser } from "../auth";
import { getProject, listProjects, type ProjectSnapshot } from "../db";
import type { Env } from "../env";
import { saveCheckpointAndReplaceDefinition } from "../replace-definition";
import {
  DefinitionEditError,
  addEnvironment,
  addTestCase,
  deleteEnvironment,
  deleteTestCase,
  renameEnvironment,
  setOverview,
  updateTestCase,
} from "./definition-edits";

export interface McpToolContext {
  env: Env;
  /** Access で認証された利用者。書き込みの実施者（executedBy）にもこのメールを使う */
  user: AuthUser;
}

/**
 * MCP から送ってよいコマンドだけ。プロジェクト削除・結果の全クリア（clearResults）・
 * results の取り込み（mergeResults）・丸ごと置き換え（replaceSnapshot / replaceDefinition）は
 * 型でも実行時でも通さない。定義の編集はサーバー側で差分を当て、定義編集画面と同じ保存処理を通す
 */
export const MCP_ALLOWED_COMMAND_TYPES = [
  "updateResult",
  "clearTestResult",
  "updateTestMemo",
  "addBug",
  "updateBug",
] as const;
export type McpAllowedCommand = Extract<
  ProjectCommand,
  { type: (typeof MCP_ALLOWED_COMMAND_TYPES)[number] }
>;

export function assertMcpAllowedCommand(command: { type: string }): asserts command is McpAllowedCommand {
  if (!(MCP_ALLOWED_COMMAND_TYPES as readonly string[]).includes(command.type)) {
    throw new Error(`Command not allowed over MCP: ${command.type}`);
  }
}

class ToolInputError extends Error {}

const STATUS = z.enum(["OK", "NG", "SKIP"]);
const SEVERITY = z.enum(["low", "medium", "high", "critical"]);
const BUG_STATUS = z.enum(BUG_STATUS_DISPLAY_ORDER as [Bug["status"], ...Bug["status"][]]);
const projectIdSchema = z.string().describe("Project id (see list_projects)");
const categorySchema = z.object({
  major: z.string(),
  medium: z.string().optional(),
  minor: z.string().optional(),
});
const targetSpecSchema = z.object({
  required: z.enum(["all", "any"]),
  targets: z.array(z.string()).optional().describe("Environment ids; omit to use every inherited environment"),
});

function jsonResult(value: unknown) {
  return {
    content: [{ type: "text" as const, text: JSON.stringify(value, null, 2) }],
    structuredContent: value as Record<string, unknown>,
  };
}

function errorResult(message: string) {
  return { content: [{ type: "text" as const, text: message }], isError: true };
}

/** AI に返すべき入力エラーはツールのエラー結果に、それ以外は例外のまま上げる */
async function run(handler: () => Promise<unknown>) {
  try {
    return jsonResult(await handler());
  } catch (err) {
    if (err instanceof ToolInputError || err instanceof DefinitionEditError) {
      return errorResult(err.message);
    }
    // 定義の保存（saveCheckpointAndReplaceDefinition）は HTTP ルートと共用で HTTPException を投げる
    if (err instanceof HTTPException && err.status === 409) {
      return errorResult(
        "The project was changed by someone else meanwhile. Read it again and retry with the latest data.",
      );
    }
    if (err instanceof HTTPException && err.status === 400) return errorResult(err.message);
    throw err;
  }
}

async function loadProject(env: Env, projectId: string): Promise<ProjectSnapshot> {
  // DO 名・DB キーに使う前に検証する（HTTP ルートの projectIdMiddleware と同じ）
  if (!PROJECT_ID_PATTERN.test(projectId)) throw new ToolInputError(`Invalid project id: ${projectId}`);
  const snapshot = await getProject(env.DB, projectId);
  if (!snapshot) throw new ToolInputError(`Project not found: ${projectId}`);
  return snapshot;
}

function findTestCase(definition: TestDefinition, testCaseId: string): TestCase {
  const testCase = definition.testCases.find((tc) => tc.id === testCaseId);
  if (!testCase) throw new ToolInputError(`Unknown test case id: ${testCaseId}`);
  return testCase;
}

function targetEnvironmentIds(definition: TestDefinition, testCase: TestCase): string[] {
  return resolveTestTargets(testCase, definition).environmentIds;
}

function assertTargetEnvironment(definition: TestDefinition, testCase: TestCase, envId: string): void {
  if (!targetEnvironmentIds(definition, testCase).includes(envId)) {
    throw new ToolInputError(
      `Environment ${envId} is not a target of ${testCase.id}. Targets: ${targetEnvironmentIds(definition, testCase).join(", ")}`,
    );
  }
}

function testCaseView(snapshot: ProjectSnapshot, testCase: TestCase, detail: boolean) {
  const { definition, results } = snapshot;
  const targets = resolveTestTargets(testCase, definition);
  const byEnv = results.results[testCase.id] ?? {};
  const envName = new Map(definition.environments.map((env) => [env.id, env.name]));
  return {
    id: testCase.id,
    category: testCase.category,
    description: testCase.description,
    ...(testCase.prerequisites ? { prerequisites: testCase.prerequisites } : {}),
    version: testCase.version ?? 1,
    completionRule: targets.required,
    results: targets.environmentIds.map((envId) => {
      const entry = byEnv[envId];
      const valid = isResultEntryValid(entry, testCase);
      return {
        environmentId: envId,
        environmentName: envName.get(envId) ?? envId,
        // version を上げる前の結果は未実施として扱う（画面と同じ）
        status: valid ? entry!.status : null,
        ...(entry && !valid ? { staleStatus: entry.status, retestNeeded: true } : {}),
        ...(valid && entry?.executedBy ? { executedBy: entry.executedBy } : {}),
        ...(valid && entry?.executedAt ? { executedAt: entry.executedAt } : {}),
      };
    }),
    ...(detail
      ? {
          memo: results.memos?.[testCase.id] ?? "",
          bugs: results.bugs
            .filter((bug) => bug.testCaseId === testCase.id)
            .map((bug) => ({ id: bug.id, title: bug.title, status: bug.status, severity: bug.severity })),
        }
      : {}),
  };
}

function bugView(bug: Bug) {
  const { attachments, ...rest } = bug;
  return { ...rest, attachmentCount: attachments?.length ?? 0 };
}

/** 1 リクエストごとに作る MCP サーバー。ツールは許可した操作だけを固定で登録する */
export function createQarowsMcpServer({ env, user }: McpToolContext): McpServer {
  const server = new McpServer({ name: "qarows-team", version: "1.0.0" });

  const applyCommand = async (projectId: string, command: McpAllowedCommand) => {
    assertMcpAllowedCommand(command);
    await env.PROJECT.getByName(projectId).applyCommandFromWorker({
      projectId,
      commandId: crypto.randomUUID(),
      command,
      user: user.email,
    });
  };

  const editDefinition = async (
    projectId: string,
    edit: (definition: TestDefinition) => TestDefinition,
  ) => {
    const snapshot = await loadProject(env, projectId);
    const next = edit(snapshot.definition);
    const { generation, revisionId } = await saveCheckpointAndReplaceDefinition(env, {
      projectId,
      testsYaml: serializeTestsYaml(next),
      expectedGeneration: snapshot.generation,
      source: "mcp",
      createdBy: user.email,
    });
    return { ok: true, generation, revisionId };
  };

  // ---- 参照系 ----

  server.registerTool(
    "whoami",
    {
      title: "Who am I",
      description: "Return the signed-in qarows user (recorded as executor for results you enter).",
      inputSchema: z.object({}),
      annotations: { readOnlyHint: true },
    },
    async () => jsonResult({ email: user.email }),
  );

  server.registerTool(
    "list_projects",
    {
      title: "List projects",
      description: "List the QA projects on this qarows Team instance.",
      inputSchema: z.object({}),
      annotations: { readOnlyHint: true },
    },
    async () => run(async () => ({ projects: await listProjects(env.DB) })),
  );

  server.registerTool(
    "get_project",
    {
      title: "Get project",
      description:
        "Project overview (Markdown onboarding notes), environments, scenarios and progress counts. Read the overview before testing.",
      inputSchema: z.object({ projectId: projectIdSchema }),
      annotations: { readOnlyHint: true },
    },
    async ({ projectId }) =>
      run(async () => {
        const snapshot = await loadProject(env, projectId);
        const { definition } = snapshot;
        const counts = { OK: 0, NG: 0, SKIP: 0, notRun: 0 };
        for (const testCase of definition.testCases) {
          for (const result of testCaseView(snapshot, testCase, false).results) {
            if (result.status) counts[result.status] += 1;
            else counts.notRun += 1;
          }
        }
        return {
          id: snapshot.id,
          name: snapshot.name,
          overview: definition.overview ?? null,
          environments: definition.environments,
          scenarios: (definition.scenarios ?? []).map((s) => ({
            id: s.id,
            name: s.name,
            ...(s.description ? { description: s.description } : {}),
            steps: s.steps,
          })),
          testCaseCount: definition.testCases.length,
          resultCounts: counts,
          openBugCount: snapshot.results.bugs.filter((b) => !isBugClosed(b.status)).length,
          updatedAt: snapshot.updatedAt,
        };
      }),
  );

  server.registerTool(
    "list_test_cases",
    {
      title: "List test cases",
      description:
        "List test cases with their per-environment results. Filter by category, scenario, result status, environment or text.",
      inputSchema: z.object({
        projectId: projectIdSchema,
        major: z.string().optional(),
        medium: z.string().optional(),
        minor: z.string().optional(),
        scenarioId: z.string().optional().describe("Return the scenario's steps in order"),
        status: z
          .enum(["notRun", "OK", "NG", "SKIP"])
          .optional()
          .describe("Keep cases with at least one target environment in this state"),
        environmentId: z.string().optional().describe("Only consider this environment (must be a target)"),
        query: z.string().optional().describe("Case-insensitive match on id, description or prerequisites"),
        offset: z.number().int().min(0).optional(),
        limit: z.number().int().min(1).max(200).optional(),
      }),
      annotations: { readOnlyHint: true },
    },
    async (input) =>
      run(async () => {
        const snapshot = await loadProject(env, input.projectId);
        const { definition } = snapshot;
        let cases = definition.testCases;
        if (input.scenarioId) {
          const scenario = definition.scenarios?.find((s) => s.id === input.scenarioId);
          if (!scenario) throw new ToolInputError(`Unknown scenario id: ${input.scenarioId}`);
          const byId = new Map(cases.map((tc) => [tc.id, tc]));
          cases = scenario.steps.map((id) => byId.get(id)).filter((tc): tc is TestCase => tc != null);
        }
        const query = input.query?.trim().toLowerCase();
        const views = cases
          .filter((tc) => !input.major || tc.category.major === input.major)
          .filter((tc) => !input.medium || tc.category.medium === input.medium)
          .filter((tc) => !input.minor || tc.category.minor === input.minor)
          .filter(
            (tc) =>
              !query ||
              [tc.id, tc.description, tc.prerequisites ?? ""].some((v) => v.toLowerCase().includes(query)),
          )
          .map((tc) => testCaseView(snapshot, tc, false))
          .map((view) =>
            input.environmentId
              ? { ...view, results: view.results.filter((r) => r.environmentId === input.environmentId) }
              : view,
          )
          .filter((view) => !input.environmentId || view.results.length > 0)
          .filter(
            (view) =>
              !input.status ||
              view.results.some((r) => (input.status === "notRun" ? r.status == null : r.status === input.status)),
          );
        const offset = input.offset ?? 0;
        const limit = input.limit ?? 50;
        return { total: views.length, offset, testCases: views.slice(offset, offset + limit) };
      }),
  );

  server.registerTool(
    "get_test_case",
    {
      title: "Get test case",
      description: "One test case with per-environment results, the memo and related bugs.",
      inputSchema: z.object({ projectId: projectIdSchema, testCaseId: z.string() }),
      annotations: { readOnlyHint: true },
    },
    async ({ projectId, testCaseId }) =>
      run(async () => {
        const snapshot = await loadProject(env, projectId);
        return testCaseView(snapshot, findTestCase(snapshot.definition, testCaseId), true);
      }),
  );

  server.registerTool(
    "list_bugs",
    {
      title: "List bugs",
      description: "List bugs, optionally filtered by status or test case.",
      inputSchema: z.object({
        projectId: projectIdSchema,
        status: BUG_STATUS.optional(),
        testCaseId: z.string().optional(),
      }),
      annotations: { readOnlyHint: true },
    },
    async ({ projectId, status, testCaseId }) =>
      run(async () => {
        const snapshot = await loadProject(env, projectId);
        const bugs = snapshot.results.bugs
          .filter((bug) => !status || bug.status === status)
          .filter((bug) => !testCaseId || bug.testCaseId === testCaseId)
          .map(bugView);
        return { total: bugs.length, bugs };
      }),
  );

  server.registerTool(
    "get_bug",
    {
      title: "Get bug",
      description: "One bug with all its fields.",
      inputSchema: z.object({ projectId: projectIdSchema, bugId: z.string() }),
      annotations: { readOnlyHint: true },
    },
    async ({ projectId, bugId }) =>
      run(async () => {
        const snapshot = await loadProject(env, projectId);
        const bug = snapshot.results.bugs.find((b) => b.id === bugId);
        if (!bug) throw new ToolInputError(`Unknown bug id: ${bugId}`);
        return bugView(bug);
      }),
  );

  // ---- 結果・メモ・バグ ----

  server.registerTool(
    "set_results",
    {
      title: "Enter results",
      description:
        "Record OK / NG / SKIP for a test case on one or more target environments (all targets when environmentIds is omitted). The signed-in user is recorded as executor. File a bug with create_bug for NG.",
      inputSchema: z.object({
        projectId: projectIdSchema,
        testCaseId: z.string(),
        status: STATUS,
        environmentIds: z.array(z.string()).min(1).optional(),
      }),
      annotations: { readOnlyHint: false, destructiveHint: false },
    },
    async ({ projectId, testCaseId, status, environmentIds }) =>
      run(async () => {
        const snapshot = await loadProject(env, projectId);
        const testCase = findTestCase(snapshot.definition, testCaseId);
        const envIds = environmentIds ?? targetEnvironmentIds(snapshot.definition, testCase);
        for (const envId of envIds) assertTargetEnvironment(snapshot.definition, testCase, envId);
        const executedAt = new Date().toISOString();
        for (const envId of envIds) {
          await applyCommand(projectId, {
            type: "updateResult",
            testCaseId,
            envId,
            entry: { status, executedAt, executedBy: user.email },
          });
        }
        return { ok: true, testCaseId, status, environmentIds: envIds };
      }),
  );

  server.registerTool(
    "clear_result",
    {
      title: "Clear a result",
      description: "Set one test case result on one environment back to not run.",
      inputSchema: z.object({ projectId: projectIdSchema, testCaseId: z.string(), environmentId: z.string() }),
      annotations: { readOnlyHint: false, destructiveHint: true },
    },
    async ({ projectId, testCaseId, environmentId }) =>
      run(async () => {
        const snapshot = await loadProject(env, projectId);
        const testCase = findTestCase(snapshot.definition, testCaseId);
        assertTargetEnvironment(snapshot.definition, testCase, environmentId);
        await applyCommand(projectId, { type: "clearTestResult", testCaseId, envId: environmentId });
        return { ok: true, testCaseId, environmentId };
      }),
  );

  server.registerTool(
    "set_memo",
    {
      title: "Set memo",
      description: "Replace the memo of a test case (shared across environments). Empty string clears it.",
      inputSchema: z.object({ projectId: projectIdSchema, testCaseId: z.string(), memo: z.string().max(10_000) }),
      annotations: { readOnlyHint: false },
    },
    async ({ projectId, testCaseId, memo }) =>
      run(async () => {
        const snapshot = await loadProject(env, projectId);
        findTestCase(snapshot.definition, testCaseId);
        await applyCommand(projectId, { type: "updateTestMemo", testCaseId, memo });
        return { ok: true, testCaseId };
      }),
  );

  const bugFields = {
    title: z.string().min(1).max(500),
    severity: SEVERITY,
    status: BUG_STATUS,
    testCaseId: z.string(),
    environmentIds: z.array(z.string()),
    assignee: z.string().max(200),
    steps: z.string().max(10_000),
    expected: z.string().max(10_000),
    actual: z.string().max(10_000),
    fixNote: z.string().max(10_000),
    memo: z.string().max(10_000),
  };

  const assertBugRefs = (definition: TestDefinition, bug: Pick<Bug, "testCaseId" | "environmentIds">) => {
    if (bug.testCaseId) findTestCase(definition, bug.testCaseId);
    const envIds = new Set(definition.environments.map((e) => e.id));
    for (const id of bug.environmentIds ?? []) {
      if (!envIds.has(id)) throw new ToolInputError(`Unknown environment id: ${id}`);
    }
  };

  server.registerTool(
    "create_bug",
    {
      title: "Create bug",
      description: "File a bug, usually linked to a test case and the environments where it failed.",
      inputSchema: z.object({
        projectId: projectIdSchema,
        title: bugFields.title,
        severity: bugFields.severity.optional().describe("Default medium"),
        status: bugFields.status.optional().describe("Default open"),
        testCaseId: bugFields.testCaseId.optional(),
        environmentIds: bugFields.environmentIds.optional(),
        assignee: bugFields.assignee.optional(),
        steps: bugFields.steps.optional(),
        expected: bugFields.expected.optional(),
        actual: bugFields.actual.optional(),
        memo: bugFields.memo.optional(),
      }),
      annotations: { readOnlyHint: false },
    },
    async ({ projectId, ...fields }) =>
      run(async () => {
        const snapshot = await loadProject(env, projectId);
        assertBugRefs(snapshot.definition, fields);
        const bug: Bug = {
          id: nextBugId(snapshot.results.bugs),
          title: fields.title.trim(),
          severity: fields.severity ?? "medium",
          status: fields.status ?? "open",
          ...(fields.testCaseId ? { testCaseId: fields.testCaseId } : {}),
          ...(fields.environmentIds?.length ? { environmentIds: fields.environmentIds } : {}),
          ...(fields.assignee?.trim() ? { assignee: fields.assignee.trim() } : {}),
          ...(fields.steps?.trim() ? { steps: fields.steps } : {}),
          ...(fields.expected?.trim() ? { expected: fields.expected } : {}),
          ...(fields.actual?.trim() ? { actual: fields.actual } : {}),
          ...(fields.memo?.trim() ? { memo: fields.memo } : {}),
        };
        await applyCommand(projectId, { type: "addBug", bug });
        return { ok: true, bug: bugView(bug) };
      }),
  );

  server.registerTool(
    "update_bug",
    {
      title: "Update bug",
      description:
        "Change fields of an existing bug (status, severity, assignee, fix note, …). Omitted fields stay as they are; an empty string clears a text field. Attachments are kept.",
      inputSchema: z.object({
        projectId: projectIdSchema,
        bugId: z.string(),
        title: bugFields.title.optional(),
        severity: bugFields.severity.optional(),
        status: bugFields.status.optional(),
        testCaseId: bugFields.testCaseId.optional().describe("Empty string unlinks the test case"),
        environmentIds: bugFields.environmentIds.optional(),
        assignee: bugFields.assignee.optional(),
        steps: bugFields.steps.optional(),
        expected: bugFields.expected.optional(),
        actual: bugFields.actual.optional(),
        fixNote: bugFields.fixNote.optional(),
        memo: bugFields.memo.optional(),
      }),
      annotations: { readOnlyHint: false },
    },
    async ({ projectId, bugId, ...patch }) =>
      run(async () => {
        const snapshot = await loadProject(env, projectId);
        const current = snapshot.results.bugs.find((b) => b.id === bugId);
        if (!current) throw new ToolInputError(`Unknown bug id: ${bugId}`);
        const next: Bug = { ...current };
        if (patch.title !== undefined) next.title = patch.title.trim();
        if (patch.severity) next.severity = patch.severity;
        if (patch.status) next.status = patch.status;
        if (patch.environmentIds) next.environmentIds = patch.environmentIds;
        for (const key of ["testCaseId", "assignee", "steps", "expected", "actual", "fixNote", "memo"] as const) {
          const value = patch[key];
          if (value === undefined) continue;
          if (value.trim()) next[key] = value;
          else delete next[key];
        }
        assertBugRefs(snapshot.definition, next);
        await applyCommand(projectId, { type: "updateBug", bug: next });
        return { ok: true, bug: bugView(next) };
      }),
  );

  // ---- テスト定義 ----

  server.registerTool(
    "add_test_case",
    {
      title: "Add test case",
      description: "Add a test case with a new unique id (e.g. TC-123).",
      inputSchema: z.object({
        projectId: projectIdSchema,
        id: z.string(),
        category: categorySchema,
        description: z.string(),
        prerequisites: z.string().optional(),
        targetEnvironments: targetSpecSchema.optional(),
      }),
      annotations: { readOnlyHint: false },
    },
    async ({ projectId, ...input }) => run(() => editDefinition(projectId, (d) => addTestCase(d, input))),
  );

  server.registerTool(
    "update_test_case",
    {
      title: "Update test case",
      description:
        "Change a test case's category, description, prerequisites or target environments. The id cannot change. Set bumpVersion when the check itself changed: existing results then count as not run (retest).",
      inputSchema: z.object({
        projectId: projectIdSchema,
        testCaseId: z.string(),
        category: categorySchema.optional(),
        description: z.string().optional(),
        prerequisites: z.string().optional().describe("Empty string removes it"),
        targetEnvironments: targetSpecSchema.nullable().optional().describe("null removes the per-case override"),
        bumpVersion: z.boolean().optional(),
      }),
      annotations: { readOnlyHint: false },
    },
    async ({ projectId, testCaseId, ...patch }) =>
      run(() => editDefinition(projectId, (d) => updateTestCase(d, testCaseId, patch))),
  );

  server.registerTool(
    "delete_test_case",
    {
      title: "Delete test case",
      description: "Delete a test case. Its results are dropped and it is removed from scenarios. Bugs keep their link text.",
      inputSchema: z.object({ projectId: projectIdSchema, testCaseId: z.string() }),
      annotations: { readOnlyHint: false, destructiveHint: true },
    },
    async ({ projectId, testCaseId }) => run(() => editDefinition(projectId, (d) => deleteTestCase(d, testCaseId))),
  );

  server.registerTool(
    "add_environment",
    {
      title: "Add environment",
      description: "Add a device / environment column (e.g. id ios-safari, name iOS Safari).",
      inputSchema: z.object({ projectId: projectIdSchema, id: z.string(), name: z.string().optional() }),
      annotations: { readOnlyHint: false },
    },
    async ({ projectId, ...input }) => run(() => editDefinition(projectId, (d) => addEnvironment(d, input))),
  );

  server.registerTool(
    "rename_environment",
    {
      title: "Rename environment",
      description: "Change the display name of an environment. The id cannot change.",
      inputSchema: z.object({ projectId: projectIdSchema, environmentId: z.string(), name: z.string() }),
      annotations: { readOnlyHint: false },
    },
    async ({ projectId, environmentId, name }) =>
      run(() => editDefinition(projectId, (d) => renameEnvironment(d, environmentId, name))),
  );

  server.registerTool(
    "delete_environment",
    {
      title: "Delete environment",
      description: "Delete an environment. It is also removed from test case and category target lists, and its results are dropped.",
      inputSchema: z.object({ projectId: projectIdSchema, environmentId: z.string() }),
      annotations: { readOnlyHint: false, destructiveHint: true },
    },
    async ({ projectId, environmentId }) =>
      run(() => editDefinition(projectId, (d) => deleteEnvironment(d, environmentId))),
  );

  server.registerTool(
    "set_overview",
    {
      title: "Set overview",
      description:
        "Replace the project overview (Markdown shown on the 概要 page: what to share before testing, accounts to use, …). Never put real passwords or secrets in it. Empty string removes it.",
      inputSchema: z.object({ projectId: projectIdSchema, overview: z.string().max(100_000) }),
      annotations: { readOnlyHint: false },
    },
    async ({ projectId, overview }) => run(() => editDefinition(projectId, (d) => setOverview(d, overview))),
  );

  return server;
}

import {
  PROJECT_ID_PATTERN,
  getProjectIdFromDefinition,
  parseTestsYaml,
  serializeResultsJson,
  type ResultsFile,
} from "@qarows/shared";
import { attachmentPrefix } from "../attachments";
import { Hono } from "hono";
import { HTTPException } from "hono/http-exception";
import type { Context } from "hono";
import { deleteProject, getProject, insertProject, listProjects, ProjectIdMismatchError } from "../db";
import {
  GenerationMismatchError,
  MergeResultsValidationError,
  assertGenerationMatch,
  mergeIncomingForNewProject,
  parseAndMergeResultsJsonList,
  parseMergeResultsBody,
  parseOptionalResultsJsonList,
} from "../merge-results";
import {
  BodyTooLargeError,
  MAX_RESULTS_JSON_BYTES,
  MAX_TESTS_YAML_BYTES,
  readRequestTextWithLimit,
} from "../request-body";
import { saveCheckpointAndReplaceDefinition } from "../replace-definition";
import { apiError, mapGenerationConflict, mapMergeValidationError, requestT } from "../i18n";
import type { AppEnv } from "../types";

interface CreateProjectBody {
  name?: string;
  testsYaml?: string;
  resultsJsonList?: unknown;
}

interface ReplaceDefinitionBody {
  testsYaml?: string;
  resultsJsonList?: unknown;
  expectedGeneration?: string;
}

interface ApplyDefinitionBody {
  testsYaml?: string;
  expectedGeneration?: string;
  instruction?: string;
}

const MAX_DEFINITION_REPLACE_BYTES = MAX_TESTS_YAML_BYTES + MAX_RESULTS_JSON_BYTES;

function internalError(c: Context<AppEnv>, context: string, err: unknown): never {
  console.error(`[${c.get("requestId")}] ${context}`, err);
  apiError(c, 500, "api.internalServerError");
}

function serializeSummaryList(projects: Awaited<ReturnType<typeof listProjects>>) {
  return projects.map((project) => ({
    id: project.id,
    name: project.name,
    updatedAt: project.updatedAt,
    createdAt: project.createdAt,
  }));
}

function serializeSnapshot(snapshot: NonNullable<Awaited<ReturnType<typeof getProject>>>) {
  return {
    id: snapshot.id,
    name: snapshot.name,
    definition: snapshot.definition,
    results: snapshot.results,
    session: snapshot.session,
    generation: snapshot.generation,
    updatedAt: snapshot.updatedAt,
    createdAt: snapshot.createdAt,
  };
}

function buildEmptyTestsYaml(name: string): string {
  const id = name
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 48) || "project";
  return `project:
  name: "${name.replace(/"/g, '\\"')}"
  id: ${id}
  version: 1

environments:
  - id: default
    name: "Default"

testCases:
  - id: TC-001
    category:
      major: "サンプル"
    description: "最初のテストケース"
`;
}

export const projectsRoutes = new Hono<AppEnv>();

projectsRoutes.get("/", async (c) => {
  const projects = await listProjects(c.env.DB);
  return c.json({ projects: serializeSummaryList(projects) });
});

projectsRoutes.post("/", async (c) => {
  const contentType = c.req.header("Content-Type") ?? "";
  let testsYaml: string | null = null;
  let resultsJsonList: string[] | undefined;

  try {
    if (contentType.includes("text/yaml") || contentType.includes("application/x-yaml")) {
      const text = await readRequestTextWithLimit(c.req.raw, MAX_TESTS_YAML_BYTES);
      testsYaml = text.trim() ? text : null;
    } else {
      const raw = await readRequestTextWithLimit(c.req.raw, MAX_DEFINITION_REPLACE_BYTES);
      if (!raw.trim()) {
        apiError(c, 400, "api.requestBodyRequired");
      }
      let body: CreateProjectBody;
      try {
        body = JSON.parse(raw) as CreateProjectBody;
      } catch {
        apiError(c, 400, "api.invalidJsonBody");
      }
      testsYaml = body.testsYaml?.trim() ?? null;
      if (!testsYaml && body.name) {
        testsYaml = buildEmptyTestsYaml(body.name);
      }
      try {
        resultsJsonList = parseOptionalResultsJsonList(body.resultsJsonList);
      } catch (err) {
        mapMergeValidationError(c, err);
      }
    }
  } catch (err) {
    if (err instanceof BodyTooLargeError) {
      apiError(c, 413, "api.requestBodyTooLargeWithLimit", {
        maxBytes: MAX_DEFINITION_REPLACE_BYTES,
      });
    }
    throw err;
  }

  if (!testsYaml) {
    apiError(c, 400, "api.testsYamlRequiredWithHint");
  }

  let definition;
  try {
    definition = parseTestsYaml(testsYaml);
  } catch (err) {
    throw new HTTPException(400, {
      message: err instanceof Error ? err.message : requestT(c, "api.invalidTestsYaml"),
    });
  }

  let resultsJson: string | undefined;
  if (resultsJsonList?.length) {
    try {
      const merged = mergeIncomingForNewProject(resultsJsonList, definition);
      if (merged) resultsJson = serializeResultsJson(merged);
    } catch (err) {
      mapMergeValidationError(c, err);
    }
  }

  try {
    const snapshot = await insertProject(c.env.DB, { testsYaml, resultsJson });
    const stub = c.env.PROJECT.getByName(snapshot.id);
    await stub.initFromD1(snapshot.id);
    return c.json({ project: serializeSnapshot(snapshot) }, 201);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to create project";
    if (message.includes("UNIQUE") || message.includes("unique")) {
      apiError(c, 409, "api.projectAlreadyExists");
    }
    internalError(c, "Failed to create project", err);
  }
});

projectsRoutes.get("/:projectId", async (c) => {
  const snapshot = await getProject(c.env.DB, c.req.param("projectId"));
  if (!snapshot) apiError(c, 404, "api.projectNotFound");
  return c.json({ project: serializeSnapshot(snapshot) });
});

projectsRoutes.put("/:projectId/definition", async (c) => {
  const projectId = c.req.param("projectId");
  const contentType = c.req.header("Content-Type") ?? "";
  let testsYaml: string;
  let resultsJsonList: string[] | undefined;
  let expectedGeneration: string | undefined;

  try {
    const raw = await readRequestTextWithLimit(c.req.raw, MAX_DEFINITION_REPLACE_BYTES);
    if (!raw.trim()) {
      apiError(c, 400, "api.requestBodyRequired");
    }

    if (contentType.includes("application/json")) {
      let body: ReplaceDefinitionBody;
      try {
        body = JSON.parse(raw) as ReplaceDefinitionBody;
      } catch {
        apiError(c, 400, "api.invalidJsonBody");
      }
      testsYaml = body.testsYaml?.trim() ?? "";
      if (!testsYaml) {
        apiError(c, 400, "api.testsYamlRequired");
      }
      expectedGeneration = body.expectedGeneration?.trim() || undefined;
      try {
        resultsJsonList = parseOptionalResultsJsonList(body.resultsJsonList);
      } catch (err) {
        mapMergeValidationError(c, err);
      }
    } else {
      testsYaml = raw;
      expectedGeneration = c.req.header("X-Expected-Generation")?.trim() || undefined;
    }
  } catch (err) {
    if (err instanceof BodyTooLargeError) {
      apiError(c, 413, "api.requestBodyTooLargeWithLimit", {
        maxBytes: MAX_DEFINITION_REPLACE_BYTES,
      });
    }
    throw err;
  }

  if (!expectedGeneration) {
    apiError(c, 400, "api.expectedGenerationRequired");
  }

  let definition;
  try {
    definition = parseTestsYaml(testsYaml);
  } catch (err) {
    throw new HTTPException(400, {
      message: err instanceof Error ? err.message : requestT(c, "api.invalidTestsYaml"),
    });
  }

  if (getProjectIdFromDefinition(definition) !== projectId) {
    apiError(c, 400, "api.projectIdMismatch");
  }

  const existing = await getProject(c.env.DB, projectId);
  if (!existing) apiError(c, 404, "api.projectNotFound");

  try {
    assertGenerationMatch(expectedGeneration, existing.generation);
  } catch (err) {
    mapGenerationConflict(c, err);
  }

  let mergeIncoming: ResultsFile | undefined;
  if (resultsJsonList?.length) {
    try {
      mergeIncoming = parseAndMergeResultsJsonList(resultsJsonList, definition);
    } catch (err) {
      mapMergeValidationError(c, err);
    }
  }

  const stub = c.env.PROJECT.getByName(projectId);
  try {
    await stub.replaceProjectFromWorker({
      projectId,
      testsYaml,
      mergeIncoming,
      expectedGeneration,
    });
  } catch (err) {
    if (err instanceof ProjectIdMismatchError) {
      apiError(c, 400, "api.projectIdMismatch");
    }
    if (err instanceof GenerationMismatchError) {
      mapGenerationConflict(c, err);
    }
    internalError(c, "Failed to replace project definition", err);
  }

  const snapshot = await getProject(c.env.DB, projectId);
  if (!snapshot) apiError(c, 404, "api.projectNotFound");
  return c.json({ project: serializeSnapshot(snapshot) });
});

projectsRoutes.post("/:projectId/definition/apply", async (c) => {
  const projectId = c.req.param("projectId");
  let body: ApplyDefinitionBody;
  try {
    const raw = await readRequestTextWithLimit(c.req.raw, MAX_TESTS_YAML_BYTES + 4096);
    body = JSON.parse(raw) as ApplyDefinitionBody;
  } catch (err) {
    if (err instanceof BodyTooLargeError) {
      apiError(c, 413, "api.requestBodyTooLarge");
    }
    apiError(c, 400, "api.invalidJsonBody");
  }

  const testsYaml = body.testsYaml?.trim();
  const expectedGeneration = body.expectedGeneration?.trim();
  if (!testsYaml) {
    apiError(c, 400, "api.testsYamlRequired");
  }
  if (!expectedGeneration) {
    apiError(c, 400, "api.expectedGenerationRequired");
  }

  const result = await saveCheckpointAndReplaceDefinition(c.env, {
    projectId,
    testsYaml,
    expectedGeneration,
    source: "manual_edit",
    instruction: body.instruction?.trim() || null,
    createdBy: c.get("user").email,
  }, c.get("locale"));

  return c.json({ ok: true, ...result });
});

projectsRoutes.delete("/:projectId", async (c) => {
  const projectId = c.req.param("projectId");
  const stub = c.env.PROJECT.getByName(projectId);
  try {
    await stub.destroy();
  } catch (err) {
    console.error("Failed to destroy project room", err);
    apiError(c, 500, "api.failedClearRoom");
  }

  const deleted = await deleteProject(c.env.DB, projectId);
  if (!deleted) apiError(c, 404, "api.projectNotFound");

  // 添付の実体を prefix で一括削除（失敗してもプロジェクト削除自体は成立させる）
  const bucket = c.env.ATTACHMENTS;
  if (bucket && PROJECT_ID_PATTERN.test(projectId)) {
    try {
      let cursor: string | undefined;
      do {
        const listing = await bucket.list({ prefix: attachmentPrefix(projectId), cursor });
        if (listing.objects.length > 0) {
          await bucket.delete(listing.objects.map((object) => object.key));
        }
        cursor = listing.truncated ? listing.cursor : undefined;
      } while (cursor);
    } catch (err) {
      console.error(`[${c.get("requestId")}] Failed to delete project attachments`, err);
    }
  }
  return c.json({ ok: true });
});

projectsRoutes.post("/:projectId/clear-results", async (c) => {
  const projectId = c.req.param("projectId");
  const snapshot = await getProject(c.env.DB, projectId);
  if (!snapshot) apiError(c, 404, "api.projectNotFound");

  const contentType = c.req.header("Content-Type") ?? "";
  if (!contentType.includes("application/json")) {
    apiError(c, 400, "api.contentTypeMustBeJson");
  }

  let body: { expectedGeneration?: string };
  try {
    const raw = await readRequestTextWithLimit(c.req.raw, 4096);
    if (!raw.trim()) {
      apiError(c, 400, "api.requestBodyRequired");
    }
    body = JSON.parse(raw) as { expectedGeneration?: string };
  } catch (err) {
    if (err instanceof BodyTooLargeError) {
      apiError(c, 413, "api.requestBodyTooLarge");
    }
    if (err instanceof HTTPException) throw err;
    apiError(c, 400, "api.invalidJsonBody");
  }

  const expectedGeneration = body.expectedGeneration?.trim();
  if (!expectedGeneration) {
    apiError(c, 400, "api.expectedGenerationRequired");
  }

  try {
    assertGenerationMatch(expectedGeneration, snapshot.generation);
  } catch (err) {
    mapGenerationConflict(c, err);
  }

  const stub = c.env.PROJECT.getByName(projectId);
  try {
    await stub.applyCommandFromWorker({
      projectId,
      expectedGeneration,
      commandId: crypto.randomUUID(),
      command: { type: "clearResults" },
      user: c.get("user").email,
    });
  } catch (err) {
    if (err instanceof GenerationMismatchError) {
      mapGenerationConflict(c, err);
    }
    internalError(c, "Failed to clear project results", err);
  }

  return c.json({ ok: true });
});

projectsRoutes.post("/:projectId/merge-results", async (c) => {
  const projectId = c.req.param("projectId");
  const snapshot = await getProject(c.env.DB, projectId);
  if (!snapshot) apiError(c, 404, "api.projectNotFound");

  let body;
  try {
    const raw = await readRequestTextWithLimit(c.req.raw, MAX_RESULTS_JSON_BYTES);
    if (!raw.trim()) {
      apiError(c, 400, "api.requestBodyRequired");
    }
    body = parseMergeResultsBody(JSON.parse(raw));
  } catch (err) {
    if (err instanceof BodyTooLargeError) {
      apiError(c, 413, "api.requestBodyTooLargeWithLimit", {
        maxBytes: MAX_RESULTS_JSON_BYTES,
      });
    }
    if (err instanceof HTTPException) throw err;
    if (err instanceof MergeResultsValidationError) {
      mapMergeValidationError(c, err);
    }
    apiError(c, 400, "api.invalidJsonBody");
  }

  try {
    assertGenerationMatch(body.expectedGeneration, snapshot.generation);
  } catch (err) {
    mapGenerationConflict(c, err);
  }

  let incoming: ResultsFile;
  try {
    incoming = parseAndMergeResultsJsonList(body.resultsJsonList, snapshot.definition);
  } catch (err) {
      mapMergeValidationError(c, err);
  }

  const stub = c.env.PROJECT.getByName(projectId);
  const user = c.get("user").email;

  try {
    await stub.applyCommandFromWorker({
      projectId,
      expectedGeneration: snapshot.generation,
      commandId: crypto.randomUUID(),
      command: { type: "mergeResults", incoming },
      user,
    });
  } catch (err) {
    if (err instanceof GenerationMismatchError) {
      mapGenerationConflict(c, err);
    }
    internalError(c, "Failed to merge project results", err);
  }

  return c.json({ ok: true });
});

projectsRoutes.get("/:projectId/ws", async (c) => {
  const projectId = c.req.param("projectId");
  const stub = c.env.PROJECT.getByName(projectId);
  return stub.fetch(c.req.raw);
});

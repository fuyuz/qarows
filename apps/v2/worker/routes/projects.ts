import { parseTestsYaml, getProjectIdFromDefinition, serializeResultsJson, type ResultsFile } from "@qarows/shared";
import { Hono } from "hono";
import { HTTPException } from "hono/http-exception";
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
import type { AppEnv } from "../types";

interface CreateProjectBody {
  name?: string;
  testsYaml?: string;
  resultsJsonList?: unknown;
}

interface ReplaceDefinitionBody {
  testsYaml?: string;
  resultsJsonList?: unknown;
}

const MAX_DEFINITION_REPLACE_BYTES = MAX_TESTS_YAML_BYTES + MAX_RESULTS_JSON_BYTES;

function internalError(c: { get: (key: "requestId") => string }, context: string, err: unknown): never {
  console.error(`[${c.get("requestId")}] ${context}`, err);
  throw new HTTPException(500, { message: "Internal server error" });
}

function mergeValidationError(err: unknown): never {
  if (err instanceof MergeResultsValidationError) {
    throw new HTTPException(400, { message: err.message });
  }
  throw err;
}

function generationConflictError(err: unknown): never {
  if (err instanceof GenerationMismatchError) {
    throw new HTTPException(409, { message: err.message });
  }
  throw err;
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
        throw new HTTPException(400, { message: "Request body is required" });
      }
      let body: CreateProjectBody;
      try {
        body = JSON.parse(raw) as CreateProjectBody;
      } catch {
        throw new HTTPException(400, { message: "Invalid JSON body" });
      }
      testsYaml = body.testsYaml?.trim() ?? null;
      if (!testsYaml && body.name) {
        testsYaml = buildEmptyTestsYaml(body.name);
      }
      try {
        resultsJsonList = parseOptionalResultsJsonList(body.resultsJsonList);
      } catch (err) {
        mergeValidationError(err);
      }
    }
  } catch (err) {
    if (err instanceof BodyTooLargeError) {
      throw new HTTPException(413, {
        message: `Request body exceeds maximum size (${MAX_DEFINITION_REPLACE_BYTES} bytes)`,
      });
    }
    throw err;
  }

  if (!testsYaml) {
    throw new HTTPException(400, { message: "testsYaml is required (JSON body or text/yaml upload)" });
  }

  let definition;
  try {
    definition = parseTestsYaml(testsYaml);
  } catch (err) {
    throw new HTTPException(400, {
      message: err instanceof Error ? err.message : "Invalid tests.yml",
    });
  }

  let resultsJson: string | undefined;
  if (resultsJsonList?.length) {
    try {
      const merged = mergeIncomingForNewProject(resultsJsonList, definition);
      if (merged) resultsJson = serializeResultsJson(merged);
    } catch (err) {
      mergeValidationError(err);
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
      throw new HTTPException(409, { message: "Project id already exists" });
    }
    internalError(c, "Failed to create project", err);
  }
});

projectsRoutes.get("/:projectId", async (c) => {
  const snapshot = await getProject(c.env.DB, c.req.param("projectId"));
  if (!snapshot) throw new HTTPException(404, { message: "Project not found" });
  return c.json({ project: serializeSnapshot(snapshot) });
});

projectsRoutes.put("/:projectId/definition", async (c) => {
  const projectId = c.req.param("projectId");
  const contentType = c.req.header("Content-Type") ?? "";
  let testsYaml: string;
  let resultsJsonList: string[] | undefined;

  try {
    const raw = await readRequestTextWithLimit(c.req.raw, MAX_DEFINITION_REPLACE_BYTES);
    if (!raw.trim()) {
      throw new HTTPException(400, { message: "Request body is required" });
    }

    if (contentType.includes("application/json")) {
      let body: ReplaceDefinitionBody;
      try {
        body = JSON.parse(raw) as ReplaceDefinitionBody;
      } catch {
        throw new HTTPException(400, { message: "Invalid JSON body" });
      }
      testsYaml = body.testsYaml?.trim() ?? "";
      if (!testsYaml) {
        throw new HTTPException(400, { message: "testsYaml is required" });
      }
      try {
        resultsJsonList = parseOptionalResultsJsonList(body.resultsJsonList);
      } catch (err) {
        mergeValidationError(err);
      }
    } else {
      testsYaml = raw;
    }
  } catch (err) {
    if (err instanceof BodyTooLargeError) {
      throw new HTTPException(413, {
        message: `Request body exceeds maximum size (${MAX_DEFINITION_REPLACE_BYTES} bytes)`,
      });
    }
    throw err;
  }

  let definition;
  try {
    definition = parseTestsYaml(testsYaml);
  } catch (err) {
    throw new HTTPException(400, {
      message: err instanceof Error ? err.message : "Invalid tests.yml",
    });
  }

  if (getProjectIdFromDefinition(definition) !== projectId) {
    throw new HTTPException(400, {
      message: "tests.yml project.id が URL の projectId と一致しません",
    });
  }

  const existing = await getProject(c.env.DB, projectId);
  if (!existing) throw new HTTPException(404, { message: "Project not found" });

  let mergeIncoming: ResultsFile | undefined;
  if (resultsJsonList?.length) {
    try {
      mergeIncoming = parseAndMergeResultsJsonList(resultsJsonList, definition);
    } catch (err) {
      mergeValidationError(err);
    }
  }

  const stub = c.env.PROJECT.getByName(projectId);
  try {
    await stub.replaceProjectFromWorker({ projectId, testsYaml, mergeIncoming });
  } catch (err) {
    if (err instanceof ProjectIdMismatchError) {
      throw new HTTPException(400, { message: err.message });
    }
    internalError(c, "Failed to replace project definition", err);
  }

  const snapshot = await getProject(c.env.DB, projectId);
  if (!snapshot) throw new HTTPException(404, { message: "Project not found" });
  return c.json({ project: serializeSnapshot(snapshot) });
});

projectsRoutes.delete("/:projectId", async (c) => {
  const projectId = c.req.param("projectId");
  const stub = c.env.PROJECT.getByName(projectId);
  try {
    await stub.destroy();
  } catch (err) {
    console.error("Failed to destroy project room", err);
    throw new HTTPException(500, { message: "Failed to clear project room" });
  }

  const deleted = await deleteProject(c.env.DB, projectId);
  if (!deleted) throw new HTTPException(404, { message: "Project not found" });
  return c.json({ ok: true });
});

projectsRoutes.post("/:projectId/clear-results", async (c) => {
  const projectId = c.req.param("projectId");
  const snapshot = await getProject(c.env.DB, projectId);
  if (!snapshot) throw new HTTPException(404, { message: "Project not found" });

  const stub = c.env.PROJECT.getByName(projectId);
  try {
    await stub.applyCommandFromWorker({
      projectId,
      commandId: crypto.randomUUID(),
      command: { type: "clearResults" },
      user: c.get("user").email,
    });
  } catch (err) {
    internalError(c, "Failed to clear project results", err);
  }

  return c.json({ ok: true });
});

projectsRoutes.post("/:projectId/merge-results", async (c) => {
  const projectId = c.req.param("projectId");
  const snapshot = await getProject(c.env.DB, projectId);
  if (!snapshot) throw new HTTPException(404, { message: "Project not found" });

  let body;
  try {
    const raw = await readRequestTextWithLimit(c.req.raw, MAX_RESULTS_JSON_BYTES);
    if (!raw.trim()) {
      throw new HTTPException(400, { message: "Request body is required" });
    }
    body = parseMergeResultsBody(JSON.parse(raw));
  } catch (err) {
    if (err instanceof BodyTooLargeError) {
      throw new HTTPException(413, {
        message: `Request body exceeds maximum size (${MAX_RESULTS_JSON_BYTES} bytes)`,
      });
    }
    if (err instanceof HTTPException) throw err;
    if (err instanceof MergeResultsValidationError) {
      throw new HTTPException(400, { message: err.message });
    }
    throw new HTTPException(400, { message: "Invalid JSON body" });
  }

  try {
    assertGenerationMatch(body.expectedGeneration, snapshot.generation);
  } catch (err) {
    generationConflictError(err);
  }

  let incoming: ResultsFile;
  try {
    incoming = parseAndMergeResultsJsonList(body.resultsJsonList, snapshot.definition);
  } catch (err) {
    mergeValidationError(err);
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
      generationConflictError(err);
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

import { parseTestsYaml, getProjectIdFromDefinition } from "@qarows/shared";
import { Hono } from "hono";
import { HTTPException } from "hono/http-exception";
import { deleteProject, getProject, insertProject, listProjects, ProjectIdMismatchError } from "../db";
import { BodyTooLargeError, MAX_TESTS_YAML_BYTES, readRequestTextWithLimit } from "../request-body";
import type { AppEnv } from "../types";

interface CreateProjectBody {
  name?: string;
  testsYaml?: string;
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

  try {
    if (contentType.includes("text/yaml") || contentType.includes("application/x-yaml")) {
      const text = await readRequestTextWithLimit(c.req.raw, MAX_TESTS_YAML_BYTES);
      testsYaml = text.trim() ? text : null;
    } else {
      const raw = await readRequestTextWithLimit(c.req.raw, MAX_TESTS_YAML_BYTES);
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
    }
  } catch (err) {
    if (err instanceof BodyTooLargeError) {
      throw new HTTPException(413, {
        message: `tests.yml exceeds maximum size (${MAX_TESTS_YAML_BYTES} bytes)`,
      });
    }
    throw err;
  }

  if (!testsYaml) {
    throw new HTTPException(400, { message: "testsYaml is required (JSON body or text/yaml upload)" });
  }

  try {
    parseTestsYaml(testsYaml);
  } catch (err) {
    throw new HTTPException(400, {
      message: err instanceof Error ? err.message : "Invalid tests.yml",
    });
  }

  try {
    const snapshot = await insertProject(c.env.DB, { testsYaml });
    const stub = c.env.PROJECT.getByName(snapshot.id);
    await stub.initFromD1(snapshot.id);
    return c.json({ project: serializeSnapshot(snapshot) }, 201);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to create project";
    if (message.includes("UNIQUE") || message.includes("unique")) {
      throw new HTTPException(409, { message: "Project id already exists" });
    }
    throw new HTTPException(500, { message });
  }
});

projectsRoutes.get("/:projectId", async (c) => {
  const snapshot = await getProject(c.env.DB, c.req.param("projectId"));
  if (!snapshot) throw new HTTPException(404, { message: "Project not found" });
  return c.json({ project: serializeSnapshot(snapshot) });
});

projectsRoutes.put("/:projectId/definition", async (c) => {
  const projectId = c.req.param("projectId");
  let testsYaml: string;

  try {
    testsYaml = await readRequestTextWithLimit(c.req.raw, MAX_TESTS_YAML_BYTES);
  } catch (err) {
    if (err instanceof BodyTooLargeError) {
      throw new HTTPException(413, {
        message: `tests.yml exceeds maximum size (${MAX_TESTS_YAML_BYTES} bytes)`,
      });
    }
    throw err;
  }

  if (!testsYaml.trim()) {
    throw new HTTPException(400, { message: "Request body is required" });
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

  const stub = c.env.PROJECT.getByName(projectId);
  try {
    await stub.replaceProjectFromWorker({ projectId, testsYaml });
  } catch (err) {
    if (err instanceof ProjectIdMismatchError) {
      throw new HTTPException(400, { message: err.message });
    }
    console.error("Failed to replace project definition", err);
    throw new HTTPException(500, {
      message: err instanceof Error ? err.message : "Failed to replace tests.yml",
    });
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
    console.error("Failed to clear project results", err);
    throw new HTTPException(500, {
      message: err instanceof Error ? err.message : "Failed to clear results",
    });
  }

  return c.json({ ok: true });
});

projectsRoutes.get("/:projectId/ws", async (c) => {
  const projectId = c.req.param("projectId");
  const stub = c.env.PROJECT.getByName(projectId);
  return stub.fetch(c.req.raw);
});

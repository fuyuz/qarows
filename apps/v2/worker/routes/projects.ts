import { parseTestsYaml } from "@qarows/shared";
import { Hono } from "hono";
import { HTTPException } from "hono/http-exception";
import { deleteProject, getProject, insertProject, listProjects } from "../db";
import { authMiddleware } from "../middleware/auth";
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

projectsRoutes.post("/", authMiddleware, async (c) => {
  const contentType = c.req.header("Content-Type") ?? "";
  let testsYaml: string | null = null;

  if (contentType.includes("application/json")) {
    const body = await c.req.json<CreateProjectBody>().catch(() => null);
    if (!body) throw new HTTPException(400, { message: "Invalid JSON body" });
    testsYaml = body.testsYaml?.trim() ?? null;
    if (!testsYaml && body.name) {
      testsYaml = buildEmptyTestsYaml(body.name);
    }
  } else if (contentType.includes("text/yaml") || contentType.includes("application/x-yaml")) {
    const text = await c.req.text();
    testsYaml = text.trim() ? text : null;
  } else {
    const body = await c.req.json<CreateProjectBody>().catch(() => null);
    testsYaml = body?.testsYaml?.trim() ?? null;
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
    await stub.initFromD1();
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

projectsRoutes.delete("/:projectId", authMiddleware, async (c) => {
  const deleted = await deleteProject(c.env.DB, c.req.param("projectId"));
  if (!deleted) throw new HTTPException(404, { message: "Project not found" });
  return c.json({ ok: true });
});

projectsRoutes.get("/:projectId/ws", async (c) => {
  const projectId = c.req.param("projectId");
  const stub = c.env.PROJECT.getByName(projectId);
  return stub.fetch(c.req.raw);
});

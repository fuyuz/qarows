import { parseTestsYaml } from "@qarows/shared";
import { getAuthUser } from "../auth";
import { deleteProject, getProject, insertProject, listProjects } from "../db";
import type { Env } from "../env";
import { badRequest, errorResponse, jsonResponse, notFound, readJson, readTextBody } from "../http";

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

export async function handleProjectsApi(
  request: Request,
  env: Env,
  projectId?: string,
): Promise<Response | null> {
  const url = new URL(request.url);

  if (!projectId && request.method === "GET" && url.pathname === "/api/projects") {
    const projects = await listProjects(env.DB);
    return jsonResponse({ projects: serializeSummaryList(projects) });
  }

  if (!projectId && request.method === "POST" && url.pathname === "/api/projects") {
    getAuthUser(request);

    const contentType = request.headers.get("Content-Type") ?? "";
    let testsYaml: string | null = null;

    if (contentType.includes("application/json")) {
      const body = await readJson<CreateProjectBody>(request);
      if (!body) return badRequest("Invalid JSON body");
      testsYaml = body.testsYaml?.trim() ?? null;
      if (!testsYaml && body.name) {
        testsYaml = buildEmptyTestsYaml(body.name);
      }
    } else if (contentType.includes("text/yaml") || contentType.includes("application/x-yaml")) {
      testsYaml = await readTextBody(request);
    } else {
      const body = await readJson<CreateProjectBody>(request);
      testsYaml = body?.testsYaml?.trim() ?? null;
    }

    if (!testsYaml) {
      return badRequest("testsYaml is required (JSON body or text/yaml upload)");
    }

    try {
      parseTestsYaml(testsYaml);
    } catch (err) {
      return badRequest(err instanceof Error ? err.message : "Invalid tests.yml");
    }

    try {
      const snapshot = await insertProject(env.DB, { testsYaml });
      const stub = env.PROJECT.getByName(snapshot.id);
      await stub.initFromD1();
      return jsonResponse({ project: serializeSnapshot(snapshot) }, { status: 201 });
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to create project";
      if (message.includes("UNIQUE") || message.includes("unique")) {
        return errorResponse("Project id already exists", 409);
      }
      return errorResponse(message, 500);
    }
  }

  if (projectId && request.method === "GET" && url.pathname === `/api/projects/${projectId}`) {
    const snapshot = await getProject(env.DB, projectId);
    if (!snapshot) return notFound("Project not found");
    return jsonResponse({ project: serializeSnapshot(snapshot) });
  }

  if (projectId && request.method === "DELETE" && url.pathname === `/api/projects/${projectId}`) {
    getAuthUser(request);
    const deleted = await deleteProject(env.DB, projectId);
    if (!deleted) return notFound("Project not found");
    return jsonResponse({ ok: true });
  }

  return null;
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

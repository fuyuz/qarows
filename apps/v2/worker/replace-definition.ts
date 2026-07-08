import { getProjectIdFromDefinition, parseTestsYaml, serializeTestsYaml } from "@qarows/shared";
import { HTTPException } from "hono/http-exception";
import {
  getDefinitionRevision,
  getProject,
  insertDefinitionRevision,
  ProjectIdMismatchError,
} from "./db";
import { assertGenerationMatch, GenerationMismatchError } from "./merge-results";
import type { Env } from "./env";

export async function replaceProjectDefinitionInRoom(
  env: Env,
  input: {
    projectId: string;
    testsYaml: string;
    expectedGeneration?: string;
  },
): Promise<{ generation: string }> {
  const existing = await getProject(env.DB, input.projectId);
  if (!existing) {
    throw new HTTPException(404, { message: "Project not found" });
  }

  if (input.expectedGeneration !== undefined) {
    try {
      assertGenerationMatch(input.expectedGeneration, existing.generation);
    } catch (err) {
      if (err instanceof GenerationMismatchError) {
        throw new HTTPException(409, { message: err.message });
      }
      throw err;
    }
  }

  let definition;
  try {
    definition = parseTestsYaml(input.testsYaml);
  } catch (err) {
    throw new HTTPException(400, {
      message: err instanceof Error ? err.message : "Invalid tests.yml",
    });
  }

  if (getProjectIdFromDefinition(definition) !== input.projectId) {
    throw new HTTPException(400, {
      message: "tests.yml project.id が URL の projectId と一致しません",
    });
  }

  const stub = env.PROJECT.getByName(input.projectId);
  try {
    await stub.replaceProjectFromWorker({
      projectId: input.projectId,
      testsYaml: input.testsYaml,
    });
  } catch (err) {
    if (err instanceof ProjectIdMismatchError) {
      throw new HTTPException(400, { message: err.message });
    }
    throw new HTTPException(500, { message: "Failed to replace project definition" });
  }

  const snapshot = await getProject(env.DB, input.projectId);
  if (!snapshot) {
    throw new HTTPException(404, { message: "Project not found" });
  }
  return { generation: snapshot.generation };
}

export async function saveCheckpointAndReplaceDefinition(
  env: Env,
  input: {
    projectId: string;
    testsYaml: string;
    expectedGeneration: string;
    source: string;
    instruction?: string | null;
    createdBy?: string | null;
  },
): Promise<{ generation: string; revisionId: string }> {
  const existing = await getProject(env.DB, input.projectId);
  if (!existing) {
    throw new HTTPException(404, { message: "Project not found" });
  }

  const revision = await insertDefinitionRevision(env.DB, {
    projectId: input.projectId,
    testsYaml: serializeTestsYaml(existing.definition),
    source: input.source,
    instruction: input.instruction,
    createdBy: input.createdBy,
  });

  const { generation } = await replaceProjectDefinitionInRoom(env, {
    projectId: input.projectId,
    testsYaml: input.testsYaml,
    expectedGeneration: input.expectedGeneration,
  });

  return { generation, revisionId: revision.id };
}

export async function restoreDefinitionRevision(
  env: Env,
  input: {
    projectId: string;
    revisionId: string;
    expectedGeneration: string;
    createdBy?: string | null;
  },
): Promise<{ generation: string }> {
  const revision = await getDefinitionRevision(env.DB, input.projectId, input.revisionId);
  if (!revision) {
    throw new HTTPException(404, { message: "Revision not found" });
  }

  const { generation } = await saveCheckpointAndReplaceDefinition(env, {
    projectId: input.projectId,
    testsYaml: revision.tests_yaml,
    expectedGeneration: input.expectedGeneration,
    source: "restore",
    instruction: revision.instruction,
    createdBy: input.createdBy,
  });

  return { generation };
}

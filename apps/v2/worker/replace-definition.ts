import {
  createI18n,
  DEFAULT_LOCALE,
  getProjectIdFromDefinition,
  parseTestsYaml,
  serializeTestsYaml,
  type Locale,
} from "@qarows/shared";
import { HTTPException } from "hono/http-exception";
import {
  getDefinitionRevision,
  getProject,
  insertDefinitionRevision,
  ProjectIdMismatchError,
} from "./db";
import { assertGenerationMatch, GenerationMismatchError } from "./merge-results";
import type { Env } from "./env";

function apiMessage(locale: Locale, key: string): string {
  return createI18n(locale).t(key);
}

export async function replaceProjectDefinitionInRoom(
  env: Env,
  input: {
    projectId: string;
    testsYaml: string;
    expectedGeneration?: string;
  },
  locale: Locale = DEFAULT_LOCALE,
): Promise<{ generation: string }> {
  const existing = await getProject(env.DB, input.projectId);
  if (!existing) {
    throw new HTTPException(404, { message: apiMessage(locale, "api.projectNotFound") });
  }

  if (input.expectedGeneration !== undefined) {
    try {
      assertGenerationMatch(input.expectedGeneration, existing.generation);
    } catch (err) {
      if (err instanceof GenerationMismatchError) {
        throw new HTTPException(409, { message: apiMessage(locale, "api.generationMismatch") });
      }
      throw err;
    }
  }

  let definition;
  try {
    definition = parseTestsYaml(input.testsYaml);
  } catch (err) {
    throw new HTTPException(400, {
      message: err instanceof Error ? err.message : apiMessage(locale, "api.invalidTestsYaml"),
    });
  }

  if (getProjectIdFromDefinition(definition) !== input.projectId) {
    throw new HTTPException(400, { message: apiMessage(locale, "api.projectIdMismatch") });
  }

  const stub = env.PROJECT.getByName(input.projectId);
  try {
    await stub.replaceProjectFromWorker({
      projectId: input.projectId,
      testsYaml: input.testsYaml,
      expectedGeneration: input.expectedGeneration,
    });
  } catch (err) {
    if (err instanceof ProjectIdMismatchError) {
      throw new HTTPException(400, { message: apiMessage(locale, "api.projectIdMismatch") });
    }
    if (err instanceof GenerationMismatchError) {
      throw new HTTPException(409, { message: apiMessage(locale, "api.generationMismatch") });
    }
    throw new HTTPException(500, { message: apiMessage(locale, "api.failedReplaceDefinition") });
  }

  const snapshot = await getProject(env.DB, input.projectId);
  if (!snapshot) {
    throw new HTTPException(404, { message: apiMessage(locale, "api.projectNotFound") });
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
  locale: Locale = DEFAULT_LOCALE,
): Promise<{ generation: string; revisionId: string }> {
  const existing = await getProject(env.DB, input.projectId);
  if (!existing) {
    throw new HTTPException(404, { message: apiMessage(locale, "api.projectNotFound") });
  }

  const revision = await insertDefinitionRevision(env.DB, {
    projectId: input.projectId,
    testsYaml: serializeTestsYaml(existing.definition),
    source: input.source,
    instruction: input.instruction,
    createdBy: input.createdBy,
  });

  const { generation } = await replaceProjectDefinitionInRoom(
    env,
    {
      projectId: input.projectId,
      testsYaml: input.testsYaml,
      expectedGeneration: input.expectedGeneration,
    },
    locale,
  );

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
  locale: Locale = DEFAULT_LOCALE,
): Promise<{ generation: string }> {
  const revision = await getDefinitionRevision(env.DB, input.projectId, input.revisionId);
  if (!revision) {
    throw new HTTPException(404, { message: apiMessage(locale, "api.revisionNotFound") });
  }

  const { generation } = await saveCheckpointAndReplaceDefinition(
    env,
    {
      projectId: input.projectId,
      testsYaml: revision.tests_yaml,
      expectedGeneration: input.expectedGeneration,
      source: "restore",
      instruction: revision.instruction,
      createdBy: input.createdBy,
    },
    locale,
  );

  return { generation };
}

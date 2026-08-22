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
import type { ProjectSnapshot } from "./db";

function apiMessage(locale: Locale, key: string): string {
  return createI18n(locale).t(key);
}

interface ReplaceDefinitionInput {
  projectId: string;
  testsYaml: string;
  expectedGeneration?: string;
}

/** 置換前の検証をまとめる。checkpoint より前に通すことで 409 / 400 で履歴を汚さない */
async function assertReplaceableDefinition(
  env: Env,
  input: ReplaceDefinitionInput,
  locale: Locale,
): Promise<ProjectSnapshot> {
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

  return existing;
}

async function replaceInRoom(
  env: Env,
  input: ReplaceDefinitionInput,
  locale: Locale,
): Promise<{ generation: string }> {
  const stub = env.PROJECT.getByName(input.projectId);
  let replaced;
  try {
    // RPC が新しい generation を返すので、D1 を読み直さない
    replaced = await stub.replaceProjectFromWorker({
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

  if (!replaced.generation) {
    throw new HTTPException(500, { message: apiMessage(locale, "api.failedReplaceDefinition") });
  }
  return { generation: replaced.generation };
}

export async function replaceProjectDefinitionInRoom(
  env: Env,
  input: ReplaceDefinitionInput,
  locale: Locale = DEFAULT_LOCALE,
): Promise<{ generation: string }> {
  await assertReplaceableDefinition(env, input, locale);
  return replaceInRoom(env, input, locale);
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
  // validate -> checkpoint -> replace の順。409 / 400 で捨てる履歴を積まない
  const existing = await assertReplaceableDefinition(env, input, locale);

  const revision = await insertDefinitionRevision(env.DB, {
    projectId: input.projectId,
    testsYaml: serializeTestsYaml(existing.definition),
    source: input.source,
    instruction: input.instruction,
    createdBy: input.createdBy,
  });

  const { generation } = await replaceInRoom(
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

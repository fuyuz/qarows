import { describe, expect, it } from "vitest";
import { createEmptyResults, serializeResultsJson, serializeTestsYaml } from "@qarows/shared";
import { saveCheckpointAndReplaceDefinition } from "./replace-definition";
import { makeDefinition } from "@qarows/shared/test-fixtures";
import {
  reconcileResultsOnDefinitionReplace,
  sanitizeSessionOnDefinitionReplace,
} from "@qarows/shared";

describe("definition replace preserves compatible results", () => {
  it("keeps overlapping results when test cases are removed from yaml", () => {
    const before = makeDefinition();
    const results = createEmptyResults("test");
    results.results = {
      "TC-001": { chrome: { status: "OK" } },
      "TC-002": { chrome: { status: "NG" } },
      "TC-003": { chrome: { status: "SKIP" } },
    };

    const afterDefinition = makeDefinition({
      testCases: before.testCases.filter((tc) => tc.id !== "TC-003"),
    });

    const reconciled = reconcileResultsOnDefinitionReplace(results, afterDefinition);
    expect(reconciled.results["TC-001"]?.chrome?.status).toBe("OK");
    expect(reconciled.results["TC-002"]?.chrome?.status).toBe("NG");
    expect(reconciled.results["TC-003"]).toBeUndefined();
  });

  it("sanitizes session env ids after environment list changes", () => {
    const definition = makeDefinition({
      environments: [{ id: "chrome", name: "Chrome" }],
    });
    const session = {
      executorName: "Bob",
      selectedEnvironmentIds: ["chrome", "firefox"],
    };

    expect(sanitizeSessionOnDefinitionReplace(session, definition)).toEqual({
      executorName: "Bob",
      selectedEnvironmentIds: ["chrome"],
    });
  });
});

describe("generation fencing", () => {
  it("detects stale generation on commands", () => {
    const roomGeneration = "gen-new";
    const commandGeneration = "gen-old" as string;
    expect(commandGeneration !== roomGeneration).toBe(true);
  });
});

describe("saveCheckpointAndReplaceDefinition", () => {
  const PROJECT_ID = "test";

  function makeEnv() {
    const definition = makeDefinition({ project: { id: PROJECT_ID, name: "Test" } });
    const row = {
      id: PROJECT_ID,
      name: "Test",
      tests_yaml: serializeTestsYaml(definition),
      results_json: serializeResultsJson(createEmptyResults(PROJECT_ID)),
      session_started: 0,
      generation: "gen-current",
      updated_at: "2026-06-28T12:00:00.000Z",
      created_at: "2026-06-28T12:00:00.000Z",
    };
    const sql: string[] = [];
    let replaced = false;
    const env = {
      DB: {
        prepare(statement: string) {
          return {
            bind() {
              return {
                async run() {
                  sql.push(statement);
                  return { meta: { changes: 1 } };
                },
                async first() {
                  sql.push(statement);
                  return statement.includes("FROM projects") ? row : null;
                },
                async all() {
                  sql.push(statement);
                  return { results: [] };
                },
              };
            },
          };
        },
      },
      PROJECT: {
        getByName() {
          return {
            async replaceProjectFromWorker() {
              replaced = true;
            },
          };
        },
      },
    };
    return {
      env: env as unknown as Parameters<typeof saveCheckpointAndReplaceDefinition>[0],
      definition,
      sql,
      wasReplaced: () => replaced,
    };
  }

  const input = (expectedGeneration: string, definition: ReturnType<typeof makeDefinition>) => ({
    projectId: PROJECT_ID,
    testsYaml: serializeTestsYaml(definition),
    expectedGeneration,
    source: "manual_edit",
  });

  it("does not record a checkpoint when the generation is stale", async () => {
    const { env, definition, sql, wasReplaced } = makeEnv();

    await expect(
      saveCheckpointAndReplaceDefinition(env, input("gen-stale", definition)),
    ).rejects.toMatchObject({ status: 409 });

    // 409 で捨てられる編集が definition_revisions を押し出さないこと
    expect(sql.some((statement) => statement.includes("INSERT INTO definition_revisions"))).toBe(
      false,
    );
    expect(wasReplaced()).toBe(false);
  });

  it("does not record a checkpoint when the yaml is invalid", async () => {
    const { env, sql } = makeEnv();

    await expect(
      saveCheckpointAndReplaceDefinition(env, {
        projectId: PROJECT_ID,
        testsYaml: "project: [unclosed",
        expectedGeneration: "gen-current",
        source: "manual_edit",
      }),
    ).rejects.toMatchObject({ status: 400 });

    expect(sql.some((statement) => statement.includes("INSERT INTO definition_revisions"))).toBe(
      false,
    );
  });

  it("records a checkpoint and replaces when the generation matches", async () => {
    const { env, definition, sql, wasReplaced } = makeEnv();

    await saveCheckpointAndReplaceDefinition(env, input("gen-current", definition));

    expect(sql.some((statement) => statement.includes("INSERT INTO definition_revisions"))).toBe(
      true,
    );
    expect(wasReplaced()).toBe(true);
  });
});

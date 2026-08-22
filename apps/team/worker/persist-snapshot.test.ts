import { describe, expect, it } from "vitest";
import { createEmptyResults } from "@qarows/shared";
import { makeDefinition } from "@qarows/shared/test-fixtures";
import { snapshotToPersisted, updateProjectSnapshot } from "./db";

const PROJECT_ID = "test";

const EXISTING_RESULTS_JSON = JSON.stringify({
  version: 1,
  projectId: PROJECT_ID,
  updatedAt: "2026-06-28T12:00:00.000Z",
  results: {},
  memos: {},
  bugs: [],
});

/** ユーザーが書いた tests.yml。コメント・並び・引用の癖をそのまま保持したい */
const HAND_WRITTEN_YAML = `# 手書きの tests.yml
project:
  name: "Demo"      # 末尾コメント
  id: test
  version: 1

environments:
  - id: chrome
    name: "Chrome"

testCases:
  - id: TC-001
    category:
      major: "Auth"
    description: "Login"
`;

interface CapturedStatement {
  sql: string;
  bindings: unknown[];
}

/** UPDATE の SQL と bind 値だけを拾う最小 D1 スタブ */
function createDbStub(row: Record<string, unknown>) {
  const statements: CapturedStatement[] = [];
  const db = {
    prepare(sql: string) {
      return {
        bind(...bindings: unknown[]) {
          return {
            async run() {
              statements.push({ sql, bindings });
              return { meta: { changes: 1 } };
            },
            async first() {
              statements.push({ sql, bindings });
              return row;
            },
            async all() {
              statements.push({ sql, bindings });
              return { results: [] };
            },
          };
        },
      };
    },
  };
  return { db: db as unknown as D1Database, statements };
}

describe("updateProjectSnapshot", () => {
  const row = {
    id: PROJECT_ID,
    name: "Demo",
    tests_yaml: HAND_WRITTEN_YAML,
    results_json: EXISTING_RESULTS_JSON,
    session_started: 0,
    generation: "gen-1",
    updated_at: "2026-06-28T12:00:00.000Z",
    created_at: "2026-06-28T12:00:00.000Z",
  };

  it("leaves tests_yaml untouched when only results change", async () => {
    const { db, statements } = createDbStub(row);

    await updateProjectSnapshot(db, PROJECT_ID, {
      resultsJson: "{}",
      sessionStarted: true,
      updatedAt: "2026-06-28T13:00:00.000Z",
    });

    const update = statements.find((statement) => statement.sql.includes("UPDATE projects"));
    expect(update?.sql).not.toContain("tests_yaml");
    expect(update?.sql).not.toContain("name =");
    expect(update?.bindings).toEqual(["{}", 1, "2026-06-28T13:00:00.000Z", PROJECT_ID]);
  });

  it("writes tests_yaml and re-derives name when the definition is given", async () => {
    const { db, statements } = createDbStub(row);
    const nextYaml = HAND_WRITTEN_YAML.replace('name: "Demo"', 'name: "Renamed"');

    await updateProjectSnapshot(db, PROJECT_ID, {
      testsYaml: nextYaml,
      resultsJson: "{}",
      updatedAt: "2026-06-28T13:00:00.000Z",
    });

    const update = statements.find((statement) => statement.sql.includes("UPDATE projects"));
    expect(update?.sql).toContain("tests_yaml = ?");
    expect(update?.bindings[0]).toBe("Renamed");
    expect(update?.bindings[1]).toBe(nextYaml);
  });
});

describe("snapshotToPersisted", () => {
  const row = {
    definition: makeDefinition(),
    results: createEmptyResults(PROJECT_ID),
    session: null,
    updatedAt: "2026-06-28T12:00:00.000Z",
  };

  it("omits testsYaml when the definition is already in D1", () => {
    const persisted = snapshotToPersisted(row, { includeTestsYaml: false });
    expect("testsYaml" in persisted).toBe(false);
    expect(persisted.resultsJson.length).toBeGreaterThan(0);
  });

  it("serializes testsYaml by default", () => {
    expect(snapshotToPersisted(row).testsYaml).toContain("project:");
  });
});

import { DatabaseSync } from "node:sqlite";
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { insertAiProposal, insertDefinitionRevision } from "./db";

const MIGRATIONS_DIR = join(import.meta.dirname, "..", "migrations");

/** 本番の DDL をそのまま流す。スタブ側のスキーマが drift しないように */
function applyMigrations(db: DatabaseSync): void {
  for (const file of readdirSync(MIGRATIONS_DIR).sort()) {
    if (file.endsWith(".sql")) db.exec(readFileSync(join(MIGRATIONS_DIR, file), "utf8"));
  }
}

/** D1 の prepare/bind/run/all/first を node:sqlite に載せた薄いスタブ（vitest は node で動く） */
function createSqliteD1(projectIds: string[] = ["p", "other"]) {
  const sqlite = new DatabaseSync(":memory:");
  applyMigrations(sqlite);
  // definition_revisions / ai_proposals は projects への FK を持つ
  for (const projectId of projectIds) {
    sqlite
      .prepare(
        `INSERT INTO projects (id, name, tests_yaml, results_json, updated_at, created_at)
         VALUES (?, ?, '', '{}', '2026-06-28T00:00:00.000Z', '2026-06-28T00:00:00.000Z')`,
      )
      .run(projectId, projectId);
  }

  const api = {
    prepare(sql: string) {
      return {
        bind(...values: unknown[]) {
          const statement = sqlite.prepare(sql);
          return {
            async run() {
              const result = statement.run(...(values as never[]));
              return { meta: { changes: Number(result.changes) } };
            },
            async all() {
              return { results: statement.all(...(values as never[])) };
            },
            async first() {
              return statement.get(...(values as never[])) ?? null;
            },
          };
        },
      };
    },
  };

  return {
    db: api as unknown as D1Database,
    /** created_at 昇順の id 一覧 */
    idsFor(table: string, projectId: string): string[] {
      const rows = sqlite
        .prepare(`SELECT id FROM ${table} WHERE project_id = ? ORDER BY created_at ASC`)
        .all(projectId) as Array<{ id: string }>;
      return rows.map((row) => row.id);
    },
    createdAtFor(table: string, projectId: string): string[] {
      const rows = sqlite
        .prepare(`SELECT created_at FROM ${table} WHERE project_id = ? ORDER BY created_at ASC`)
        .all(projectId) as Array<{ created_at: string }>;
      return rows.map((row) => row.created_at);
    },
  };
}

/** created_at を 1 分刻みで振る。同一ミリ秒だと保持される向きが観測できない */
function at(minute: number): Date {
  return new Date(Date.UTC(2026, 5, 28, 0, minute, 0));
}

describe("definition revision retention", () => {
  it("keeps the newest 20 and leaves other projects alone", async () => {
    const { db, idsFor, createdAtFor } = createSqliteD1();

    for (let index = 0; index < 25; index += 1) {
      await insertDefinitionRevision(db, {
        projectId: "p",
        testsYaml: `# ${index}`,
        source: "manual_edit",
        now: at(index),
      });
      await insertDefinitionRevision(db, {
        projectId: "other",
        testsYaml: `# other ${index}`,
        source: "manual_edit",
        now: at(index),
      });
    }

    // 古い 5 件が落ち、新しい 20 件が残る（向きが逆なら at(0) 側が残る）
    expect(createdAtFor("definition_revisions", "p")).toEqual(
      Array.from({ length: 20 }, (_, index) => at(index + 5).toISOString()),
    );
    expect(idsFor("definition_revisions", "other")).toHaveLength(20);
  });
});

describe("ai proposal retention", () => {
  it("keeps the newest 20", async () => {
    const { db, createdAtFor } = createSqliteD1();

    for (let index = 0; index < 24; index += 1) {
      await insertAiProposal(db, {
        projectId: "p",
        proposedYaml: `# ${index}`,
        baseGeneration: "gen-1",
        now: at(index),
      });
    }

    expect(createdAtFor("ai_proposals", "p")).toEqual(
      Array.from({ length: 20 }, (_, index) => at(index + 4).toISOString()),
    );
  });

  it("prunes expired proposals before applying the retention limit", async () => {
    const { db, createdAtFor } = createSqliteD1();

    await insertAiProposal(db, {
      projectId: "p",
      proposedYaml: "# old",
      baseGeneration: "gen-1",
      now: at(0),
    });
    expect(createdAtFor("ai_proposals", "p")).toHaveLength(1);

    // TTL を跨いだ次の insert で期限切れが落ちる
    await insertAiProposal(db, {
      projectId: "p",
      proposedYaml: "# new",
      baseGeneration: "gen-1",
      now: at(60 * 24 * 30),
    });

    expect(createdAtFor("ai_proposals", "p")).toEqual([at(60 * 24 * 30).toISOString()]);
  });
});

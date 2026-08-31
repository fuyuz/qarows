import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import Ajv2020 from "ajv/dist/2020";
import addFormats from "ajv-formats";
import { load as loadYaml } from "js-yaml";
import { describe, expect, it } from "vitest";
import {
  createEmptyResults,
  parseResultsJson,
  parseTestsYaml,
  serializeResultsJson,
  serializeTestsYaml,
  type Bug,
  type ResultsFile,
} from "@qarows/shared";
import testsSchema from "@qarows/shared/schemas/tests.schema.json";
import resultsSchema from "@qarows/shared/schemas/results.schema.json";

/**
 * JSON Schema とパーサは二重管理になっている（docs/data-format.md はパーサを正とし、
 * スキーマは公開する契約という位置づけ）。片方だけ直しても従来どちらのテストも落ちな
 * かったので、同じデータが両方を通ることをここで縛る。
 *
 * 3 方向を見る必要がある:
 *   ファイル → スキーマ  生の YAML を検証する。パース結果を渡すと、パーサが捨てる
 *                        未知のキーが素通りしてしまう
 *   ファイル → パーサ    parseTestsYaml が受け付ける
 *   パーサ   → スキーマ  パース結果もスキーマ適合（パーサが増やした項目の取り残し）
 *
 * 素材はリポジトリのサンプル。デモと Local 版の QA チェックリストを兼ねていて機能追加
 * ごとに育つので、スキーマが取り残されればここで気づける。
 */

const repoRoot = path.join(path.dirname(fileURLToPath(import.meta.url)), "../../../..");
const samplePath = path.join(repoRoot, "apps/local/public/samples/tests.yml");
const sampleYaml = readFileSync(samplePath, "utf8");

function validator(schema: object) {
  const ajv = new Ajv2020({ allErrors: true, strict: true });
  addFormats(ajv);
  return ajv.compile(schema);
}

/** ajv に渡せるのは JSON。YAML の Date や undefined を落として素の JSON にする */
function toJson<T>(value: T): unknown {
  return JSON.parse(JSON.stringify(value));
}

function messages(errors: unknown): string {
  return JSON.stringify(errors, null, 2);
}

function expectValid(schema: object, value: unknown): void {
  const validate = validator(schema);
  expect(validate(toJson(value)), messages(validate.errors)).toBe(true);
}

describe("sample tests.yml", () => {
  it("validates against tests.schema.json as written", () => {
    expectValid(testsSchema, loadYaml(sampleYaml));
  });

  it("parses with parseTestsYaml", () => {
    const definition = parseTestsYaml(sampleYaml);
    expect(definition.project.id).toBe("qarows");
    expect(definition.testCases.length).toBeGreaterThan(0);
    expect(definition.environments.length).toBeGreaterThan(0);
  });

  it("stays valid once parsed", () => {
    expectValid(testsSchema, parseTestsYaml(sampleYaml));
  });

  it("stays valid after a serialize round trip", () => {
    const round = serializeTestsYaml(parseTestsYaml(sampleYaml));
    expectValid(testsSchema, loadYaml(round));
    expect(parseTestsYaml(round).testCases).toHaveLength(
      parseTestsYaml(sampleYaml).testCases.length,
    );
  });
});

describe("results.json", () => {
  /**
   * describe 本体で parse すると、サンプルが壊れたときモジュール読み込みで落ちて
   * vitest が「no tests」しか出さない。どのテストが落ちたか分かるよう遅延させる
   */
  function fixture() {
    const definition = parseTestsYaml(sampleYaml);
    return {
      definition,
      // project.id は型上 optional。サンプルには必ずある（未設定なら parseTestsYaml が落ちる）
      projectId: definition.project.id!,
      firstCase: definition.testCases[0]!,
      secondCase: definition.testCases[1]!,
      firstEnv: definition.environments[0]!,
    };
  }

  /**
   * スキーマの興味のある枝（results / memos / bugs）を埋める。
   * エントリの version は「1 は省略、明示するのは 2 以上」という規約なので両方入れる
   */
  function sampleResults(): ResultsFile {
    const { projectId, firstCase, secondCase, firstEnv } = fixture();
    const bug: Bug = {
      id: "BUG-k7m2x9",
      title: "サンプルのバグ",
      severity: "high",
      status: "open",
      testCaseId: firstCase.id,
      environmentIds: [firstEnv.id],
      steps: "手順",
      expected: "期待",
      actual: "実際",
      assignee: "qa",
    };
    return {
      ...createEmptyResults(projectId),
      updatedAt: "2026-08-31T00:00:00.000Z",
      results: {
        [firstCase.id]: {
          [firstEnv.id]: {
            status: "NG",
            executedAt: "2026-08-31T00:00:00.000Z",
            executedBy: "qa",
            version: 2,
          },
        },
        [secondCase.id]: {
          [firstEnv.id]: {
            status: "OK",
            executedAt: "2026-08-31T00:00:00.000Z",
            executedBy: "qa",
          },
        },
      },
      memos: { [firstCase.id]: "メモ" },
      bugs: [bug],
    };
  }

  it("validates against results.schema.json", () => {
    expectValid(resultsSchema, sampleResults());
  });

  it("serializes to something the schema accepts", () => {
    expectValid(resultsSchema, JSON.parse(serializeResultsJson(sampleResults())));
  });

  it("parses with parseResultsJson", () => {
    const { definition, projectId, firstCase, firstEnv } = fixture();
    const parsed = parseResultsJson(serializeResultsJson(sampleResults()), { definition });
    expect(parsed.projectId).toBe(projectId);
    expect(parsed.results[firstCase.id]?.[firstEnv.id]?.status).toBe("NG");
    expect(parsed.bugs).toHaveLength(1);
  });

  it("stays valid after a serialize round trip", () => {
    const { definition } = fixture();
    expectValid(
      resultsSchema,
      parseResultsJson(serializeResultsJson(sampleResults()), { definition }),
    );
  });

  it("createEmptyResults alone is valid", () => {
    expectValid(resultsSchema, createEmptyResults("qarows"));
  });

  /**
   * スキーマは entry.version の minimum を 2 に置き、1 は省略で表す約束にしている。
   * シリアライザがその約束を破ると出力がスキーマ不適合になるので、ここで固定する
   */
  it("never writes an explicit version 1", () => {
    const { projectId, firstCase, firstEnv } = fixture();
    const withVersionOne: ResultsFile = {
      ...createEmptyResults(projectId),
      results: {
        [firstCase.id]: { [firstEnv.id]: { status: "OK", version: 1 } },
      },
    };
    const json = JSON.parse(serializeResultsJson(withVersionOne)) as {
      results: Record<string, Record<string, { version?: number }>>;
    };
    expect(json.results[firstCase.id]?.[firstEnv.id]).not.toHaveProperty("version");
    expectValid(resultsSchema, json);
  });
});

import { describe, expect, it } from "vitest";
import { makeDefinition } from "./test-fixtures";
import { parseResultsJson } from "./parse-results";
import { parseTestsYaml } from "./parse-tests";
import { mergeResultsFiles } from "./merge-results";
import type { ResultsFile } from "./types";

const definition = makeDefinition();

/**
 * JSON は文字列で組む。オブジェクトリテラルの `__proto__:` は（引用符付きでも）
 * 自身の prototype を差し替えるだけで own property にならず、JSON.stringify に現れない
 */
const RESULTS_WITH_PROTO = `{
  "projectId": "test",
  "results": {
    "TC-001": { "chrome": { "status": "OK" } },
    "__proto__": { "chrome": { "status": "NG" } }
  },
  "memos": { "__proto__": "injected" },
  "bugs": []
}`;

const RESULTS_WITH_PROTO_ENV = `{
  "projectId": "test",
  "results": {
    "TC-001": { "chrome": { "status": "OK" }, "__proto__": { "status": "NG" } }
  },
  "bugs": []
}`;

describe("parseResultsJson prototype keys", () => {
  it("rejects a __proto__ testCaseId instead of replacing the map prototype", () => {
    expect(() => parseResultsJson(RESULTS_WITH_PROTO, { definition })).toThrow(/__proto__/);
  });

  it("rejects a __proto__ environmentId", () => {
    expect(() => parseResultsJson(RESULTS_WITH_PROTO_ENV, { definition })).toThrow(/__proto__/);
  });

  it("rejects a __proto__ memo key", () => {
    const raw = `{"projectId":"test","results":{},"memos":{"__proto__":"x"},"bugs":[]}`;
    expect(() => parseResultsJson(raw, { definition })).toThrow(/__proto__/);
  });

  it("still rejects other undefined ids", () => {
    const raw = `{"projectId":"test","results":{"TC-999":{"chrome":{"status":"OK"}}},"bugs":[]}`;
    expect(() => parseResultsJson(raw, { definition })).toThrow(/TC-999/);
  });

  it("leaves the parsed maps on Object.prototype for valid files", () => {
    const raw = `{"projectId":"test","results":{"TC-001":{"chrome":{"status":"OK"}}},"memos":{"TC-001":"note"},"bugs":[]}`;
    const parsed = parseResultsJson(raw, { definition });
    expect(Object.getPrototypeOf(parsed.results)).toBe(Object.prototype);
    expect(Object.getPrototypeOf(parsed.results["TC-001"])).toBe(Object.prototype);
    expect(Object.getPrototypeOf(parsed.memos)).toBe(Object.prototype);
  });
});

describe("parseTestsYaml prototype ids", () => {
  const base = `
project:
  name: X
  id: x
`;

  it("rejects __proto__ as a test case id", () => {
    const yaml = `${base}
environments:
  - id: chrome
    name: Chrome
testCases:
  - id: __proto__
    category:
      major: A
    description: d
`;
    expect(() => parseTestsYaml(yaml)).toThrow(/__proto__/);
  });

  it("rejects __proto__ as an environment id", () => {
    for (const environments of ['  - __proto__', '  - id: __proto__\n    name: Weird']) {
      const yaml = `${base}
environments:
${environments}
testCases:
  - id: TC-001
    category:
      major: A
    description: d
`;
      expect(() => parseTestsYaml(yaml)).toThrow(/__proto__/);
    }
  });

  it("rejects __proto__ as a scenario id", () => {
    const yaml = `${base}
environments:
  - id: chrome
    name: Chrome
testCases:
  - id: TC-001
    category:
      major: A
    description: d
scenarios:
  - id: __proto__
    name: Weird
    steps:
      - TC-001
`;
    expect(() => parseTestsYaml(yaml)).toThrow(/__proto__/);
  });
});

describe("mergeResultsFiles prototype keys", () => {
  function withProtoResults(): ResultsFile {
    const file: ResultsFile = {
      version: 1,
      projectId: "test",
      updatedAt: "2026-06-28T12:00:00.000Z",
      // 入口を通らずに組まれた（= 将来の producer が作りうる）own __proto__ キー
      results: JSON.parse(`{"__proto__":{"chrome":{"status":"NG"}}}`) as ResultsFile["results"],
      memos: JSON.parse(`{"__proto__":"x"}`) as ResultsFile["memos"],
      bugs: [],
    };
    return file;
  }

  function emptyResults(): ResultsFile {
    return {
      version: 1,
      projectId: "test",
      updatedAt: "2026-06-28T12:00:00.000Z",
      results: {},
      memos: {},
      bugs: [],
    };
  }

  it("never writes onto Object.prototype", () => {
    const before = Object.getOwnPropertyNames(Object.prototype).length;
    const merged = mergeResultsFiles(emptyResults(), withProtoResults());

    expect(Object.getOwnPropertyNames(Object.prototype)).toHaveLength(before);
    expect(
      (Object.prototype as unknown as Record<string, unknown>).chrome,
    ).toBeUndefined();
    expect(Object.keys(merged.results)).toEqual([]);
    expect(Object.keys(merged.memos)).toEqual([]);
  });
});

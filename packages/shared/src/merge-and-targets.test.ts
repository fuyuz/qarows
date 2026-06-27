import { describe, expect, it } from "vitest";
import { aggregateValidTestStatus } from "./aggregate-test-status";
import { mergeResultsFiles } from "./merge-results";
import { resolveSessionTestTargets } from "./resolve-test-targets";
import type { ResultsFile, TestCase, TestDefinition, TestResults } from "./types";

function makeDefinition(overrides: Partial<TestDefinition> = {}): TestDefinition {
  return {
    project: { name: "Test", id: "test" },
    environments: [
      { id: "chrome", name: "Chrome" },
      { id: "ios", name: "iOS" },
    ],
    testCases: [
      {
        id: "TC-001",
        version: 2,
        category: { major: "Auth" },
        description: "Login",
      },
    ],
    ...overrides,
  };
}

describe("resolveSessionTestTargets", () => {
  it("treats empty targets as no environments in scope", () => {
    const definition = makeDefinition({
      testCases: [
        {
          id: "TC-001",
          category: { major: "Auth" },
          description: "Login",
          targetEnvironments: { required: "all", targets: [] },
        },
      ],
    });
    const testCase = definition.testCases[0]!;
    const targets = resolveSessionTestTargets(testCase, definition, ["chrome", "ios"]);
    expect(targets.environmentIds).toEqual([]);
    expect(targets.inScope).toBe(false);
  });
});

describe("aggregateValidTestStatus", () => {
  const testCase: TestCase = {
    id: "TC-001",
    version: 2,
    category: { major: "Auth" },
    description: "Login",
  };

  it("ignores stale version results when aggregating", () => {
    const results: TestResults = {
      "TC-001": {
        chrome: { status: "NG", version: 1 },
        ios: { status: "OK", version: 2 },
      },
    };

    expect(aggregateValidTestStatus(testCase, ["chrome", "ios"], results)).toBe("OK");
  });

  it("returns strongest status across valid environments", () => {
    const results: TestResults = {
      "TC-001": {
        chrome: { status: "OK", version: 2 },
        ios: { status: "NG", version: 2 },
      },
    };

    expect(aggregateValidTestStatus(testCase, ["chrome", "ios"], results)).toBe("NG");
  });

  it("returns null when no valid results exist", () => {
    expect(aggregateValidTestStatus(testCase, ["chrome"], {})).toBeNull();
  });
});

describe("mergeResultsFiles", () => {
  const base: ResultsFile = {
    version: 1,
    projectId: "test",
    updatedAt: "2026-01-01T00:00:00.000Z",
    results: {
      "TC-001": {
        chrome: { status: "NG", version: 1, executedAt: "2026-01-01T00:00:00.000Z" },
      },
    },
    bugs: [],
  };

  it("prefers higher version over stronger status", () => {
    const incoming: ResultsFile = {
      ...base,
      results: {
        "TC-001": {
          chrome: { status: "OK", version: 2, executedAt: "2026-01-02T00:00:00.000Z" },
        },
      },
    };

    const merged = mergeResultsFiles(base, incoming);
    expect(merged.results["TC-001"]?.chrome?.status).toBe("OK");
    expect(merged.results["TC-001"]?.chrome?.version).toBe(2);
  });

  it("uses stronger status when versions match", () => {
    const incoming: ResultsFile = {
      ...base,
      results: {
        "TC-001": {
          chrome: { status: "SKIP", executedAt: "2026-01-02T00:00:00.000Z" },
        },
      },
    };

    const merged = mergeResultsFiles(base, incoming);
    expect(merged.results["TC-001"]?.chrome?.status).toBe("NG");
  });
});

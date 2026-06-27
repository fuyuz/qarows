import { describe, expect, it } from "vitest";
import { mergeResultsFiles } from "./merge-results";
import {
  formatTestCaseLabel,
  getTestCaseAggregateStatus,
  resolveRunnerTestCases,
} from "./resolve-runner-targets";
import { makeDefinition } from "./test-fixtures";
import type { ResultsFile, SessionConfig, TestResults } from "./types";

const session: SessionConfig = {
  executorName: "qa",
  selectedEnvironmentIds: ["chrome", "firefox"],
};

describe("mergeResultsFiles extras", () => {
  const base: ResultsFile = {
    version: 1,
    projectId: "test",
    updatedAt: "2026-01-01T00:00:00.000Z",
    results: {
      "TC-001": {
        chrome: { status: "OK", memo: "left" },
      },
    },
    bugs: [{ id: "BUG-001", title: "Old", severity: "low", status: "open" }],
  };

  it("merges memos with separator", () => {
    const incoming: ResultsFile = {
      ...base,
      results: {
        "TC-001": {
          chrome: { status: "OK", memo: "right" },
        },
      },
    };
    const merged = mergeResultsFiles(base, incoming);
    expect(merged.results["TC-001"]?.chrome?.memo).toBe("left\n---\nright");
  });

  it("merges bugs by id", () => {
    const incoming: ResultsFile = {
      ...base,
      bugs: [{ id: "BUG-001", title: "Updated", severity: "high", status: "in_progress" }],
    };
    const merged = mergeResultsFiles(base, incoming);
    expect(merged.bugs[0]).toMatchObject({
      id: "BUG-001",
      title: "Updated",
      severity: "high",
      status: "in_progress",
    });
  });

  it("rejects mismatched projectId", () => {
    expect(() =>
      mergeResultsFiles(base, { ...base, projectId: "other" }),
    ).toThrow("projectId が一致しません");
  });
});

describe("resolveRunnerTestCases", () => {
  const definition = makeDefinition({
    scenarios: [
      {
        id: "smoke",
        name: "Smoke",
        steps: ["TC-002", "TC-001"],
      },
    ],
  });

  it("filters by major category", () => {
    const cases = resolveRunnerTestCases(
      definition,
      session,
      { onlyIncomplete: false, majorCategoryFilter: "Billing" },
      {},
    );
    expect(cases.map((tc) => tc.id)).toEqual(["TC-003"]);
  });

  it("orders scenario steps", () => {
    const cases = resolveRunnerTestCases(
      definition,
      session,
      { targetMode: "scenario", scenarioId: "smoke", onlyIncomplete: false },
      {},
    );
    expect(cases.map((tc) => tc.id)).toEqual(["TC-002", "TC-001"]);
  });

  it("skips scenario steps that are out of session scope", () => {
    const scopedDefinition = makeDefinition({
      testCases: [
        {
          id: "TC-001",
          category: { major: "Auth" },
          description: "Chrome only",
          targetEnvironments: { required: "all", targets: ["chrome"] },
        },
        {
          id: "TC-002",
          category: { major: "Auth" },
          description: "Safari only",
          targetEnvironments: { required: "all", targets: ["safari"] },
        },
      ],
      scenarios: [{ id: "mixed", name: "Mixed", steps: ["TC-001", "TC-002"] }],
    });
    const safariSession: SessionConfig = {
      ...session,
      selectedEnvironmentIds: ["safari"],
    };
    const cases = resolveRunnerTestCases(
      scopedDefinition,
      safariSession,
      { targetMode: "scenario", scenarioId: "mixed", onlyIncomplete: false },
      {},
    );
    expect(cases.map((tc) => tc.id)).toEqual(["TC-002"]);
  });

  it("excludes complete tests when onlyIncomplete is true", () => {
    const results: TestResults = {
      "TC-001": { chrome: { status: "OK" }, firefox: { status: "OK" } },
    };
    const cases = resolveRunnerTestCases(
      definition,
      session,
      { onlyIncomplete: true },
      results,
    );
    expect(cases.some((tc) => tc.id === "TC-001")).toBe(false);
  });
});

describe("getTestCaseAggregateStatus", () => {
  it("returns incomplete for missing results", () => {
    const testCase = makeDefinition().testCases[0]!;
    expect(
      getTestCaseAggregateStatus(testCase, makeDefinition(), session.selectedEnvironmentIds, {}),
    ).toBe("incomplete");
  });
});

describe("formatTestCaseLabel", () => {
  it("prefers minor category when present", () => {
    const testCase = makeDefinition({
      testCases: [
        {
          id: "TC-001",
          category: { major: "Auth", medium: "Login", minor: "OAuth" },
          description: "Long description that should not be used",
        },
      ],
    }).testCases[0]!;
    expect(formatTestCaseLabel(testCase)).toBe("OAuth");
  });

  it("truncates long descriptions", () => {
    const testCase = makeDefinition({
      testCases: [
        {
          id: "TC-001",
          category: { major: "Auth" },
          description: "x".repeat(40),
        },
      ],
    }).testCases[0]!;
    expect(formatTestCaseLabel(testCase)).toMatch(/…$/);
  });
});

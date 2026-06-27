import { describe, expect, it } from "vitest";
import { clearTestCaseEnvironmentResult } from "./clear-results";
import type { ResultsFile } from "./types";

const base: ResultsFile = {
  version: 1,
  projectId: "test",
  updatedAt: "2026-01-01T00:00:00.000Z",
  results: {
    "TC-001": {
      chrome: { status: "OK" },
      firefox: { status: "NG" },
    },
    "TC-002": {
      chrome: { status: "SKIP" },
    },
  },
  bugs: [],
};

describe("clearTestCaseEnvironmentResult", () => {
  it("removes one environment entry", () => {
    const next = clearTestCaseEnvironmentResult(base, "TC-001", "chrome");
    expect(next.results["TC-001"]).toEqual({ firefox: { status: "NG" } });
    expect(next.results["TC-002"]).toEqual(base.results["TC-002"]);
  });

  it("removes testCaseId when last environment is cleared", () => {
    const next = clearTestCaseEnvironmentResult(base, "TC-002", "chrome");
    expect(next.results["TC-002"]).toBeUndefined();
    expect(Object.keys(next.results)).toEqual(["TC-001"]);
  });

  it("returns same object when entry is missing", () => {
    expect(clearTestCaseEnvironmentResult(base, "TC-001", "safari")).toBe(base);
  });
});

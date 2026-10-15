import { describe, expect, it } from "vitest";
import { makeDefinition } from "@qarows/shared/test-fixtures";
import { canJumpToRunner, findRunnerIndex, runnerFiltersForJump } from "./jump-to-runner";
import type { ResultsFile, SessionConfig } from "@qarows/shared";

const definition = makeDefinition();
const session: SessionConfig = {
  executorName: "qa",
  selectedEnvironmentIds: ["chrome"],
};
const results: ResultsFile = {
  version: 1,
  projectId: "test",
  updatedAt: "2026-01-01T00:00:00.000Z",
  results: {},
  memos: {},
  bugs: [],
};

describe("canJumpToRunner", () => {
  it("requires valid session and in-scope test case", () => {
    expect(canJumpToRunner("TC-001", definition, session)).toBe(true);
    expect(canJumpToRunner("TC-001", definition, null)).toBe(false);
    expect(canJumpToRunner("TC-999", definition, session)).toBe(false);
  });
});

describe("findRunnerIndex", () => {
  it("returns index within filtered runner list", () => {
    expect(
      findRunnerIndex("TC-002", definition, session, results, {
        onlyIncomplete: false,
        onlyWithBugs: false,
        onlyWithNg: false,
        onlyWithSkip: false,
      }),
    ).toBe(1);
    expect(
      findRunnerIndex("TC-999", definition, session, results, {
        onlyIncomplete: false,
        onlyWithBugs: false,
        onlyWithNg: false,
        onlyWithSkip: false,
      }),
    ).toBeNull();
  });
});

describe("runnerFiltersForJump", () => {
  const noFlags = { onlyIncomplete: false, onlyWithBugs: false, onlyWithNg: false, onlyWithSkip: false };
  const withTc001Done: ResultsFile = {
    ...results,
    results: { "TC-001": { chrome: { status: "OK" } } },
  };

  it("keeps filters that already include the target", () => {
    const filters = { ...noFlags, onlyIncomplete: true, majorCategoryFilter: "Auth" };
    expect(runnerFiltersForJump("TC-002", definition, session, withTc001Done, filters)).toBe(filters);
  });

  it("drops scope flags that would hide a completed target but keeps the category", () => {
    const filters = { ...noFlags, onlyIncomplete: true, majorCategoryFilter: "Auth" };
    expect(runnerFiltersForJump("TC-001", definition, session, withTc001Done, filters)).toEqual({
      ...noFlags,
      majorCategoryFilter: "Auth",
    });
  });

  it("falls back to an unfiltered list when the category hides the target", () => {
    const filters = { ...noFlags, majorCategoryFilter: "Billing" };
    expect(runnerFiltersForJump("TC-001", definition, session, results, filters)).toEqual({
      targetMode: "filter",
      ...noFlags,
    });
  });
});

import { describe, expect, it } from "vitest";
import type { ResultsFile, TestDefinition } from "@qarows/shared";
import {
  isRunnerFiltersSettled,
  parseRunnerSearchParams,
  parseScopeFilterTokens,
  queryToRunnerFilters,
  runnerFiltersToQuery,
  runnerFiltersToSearchParams,
  runnerSearchChanged,
  sanitizeRunnerSearchParams,
  searchParamsToRunnerQuery,
} from "@/lib/runner-query";

const definition: TestDefinition = {
  project: { name: "Demo", id: "demo" },
  environments: [{ id: "chrome", name: "Chrome" }],
  testCases: [{ id: "TC-001", category: { major: "Auth" }, description: "Login" }],
};

const results: ResultsFile = {
  version: 1,
  projectId: "demo",
  updatedAt: "2026-01-01T00:00:00Z",
  results: {},
  bugs: [{ id: "BUG-001", title: "Crash", severity: "high", status: "open" }],
};

const defaultScopeFilters = {
  onlyIncomplete: false,
  onlyWithBugs: false,
  onlyWithNg: false,
};

describe("runner query roundtrip", () => {
  it("parses filter mode from URL", () => {
    const params = new URLSearchParams(
      "major=Auth&medium=Login&filters=incomplete&test=TC-001",
    );
    const { filters, testId } = parseRunnerSearchParams(params);
    expect(filters).toEqual({
      targetMode: "filter",
      majorCategoryFilter: "Auth",
      mediumCategoryFilter: "Login",
      onlyIncomplete: true,
      onlyWithBugs: false,
      onlyWithNg: false,
    });
    expect(testId).toBe("TC-001");
  });

  it("parses legacy incomplete flag into filters tokens", () => {
    expect(parseScopeFilterTokens(new URLSearchParams("incomplete=1"))).toEqual(["incomplete"]);
    expect(parseScopeFilterTokens(new URLSearchParams("withBugs=1&withNg=1"))).toEqual([
      "ng",
      "bugs",
    ]);
  });

  it("parses scenario mode from URL", () => {
    const query = searchParamsToRunnerQuery(new URLSearchParams("mode=scenario&scenario=smoke"));
    expect(queryToRunnerFilters(query)).toEqual({
      targetMode: "scenario",
      scenarioId: "smoke",
      ...defaultScopeFilters,
    });
    expect(isRunnerFiltersSettled(queryToRunnerFilters(query))).toBe(true);
  });

  it("serializes filters back to search params", () => {
    const params = runnerFiltersToSearchParams(
      {
        targetMode: "filter",
        majorCategoryFilter: "Auth",
        onlyIncomplete: true,
        onlyWithBugs: false,
        onlyWithNg: false,
      },
      "TC-002",
    );
    expect(params.get("major")).toBe("Auth");
    expect(params.get("filters")).toBe("incomplete");
    expect(params.get("test")).toBe("TC-002");
    expect(params.get("mode")).toBeNull();
  });

  it("roundtrips minor category filter", () => {
    const params = new URLSearchParams("major=Auth&medium=Login&minor=OAuth&test=TC-001");
    const { filters, testId } = parseRunnerSearchParams(params);
    expect(filters).toEqual({
      targetMode: "filter",
      majorCategoryFilter: "Auth",
      mediumCategoryFilter: "Login",
      minorCategoryFilter: "OAuth",
      ...defaultScopeFilters,
    });
    expect(testId).toBe("TC-001");

    const serialized = runnerFiltersToSearchParams(filters, testId);
    expect(serialized.get("minor")).toBe("OAuth");
  });

  it("roundtrips combined scope filters", () => {
    const params = new URLSearchParams("filters=incomplete,ng,bugs");
    const { filters } = parseRunnerSearchParams(params);
    expect(filters.onlyIncomplete).toBe(true);
    expect(filters.onlyWithNg).toBe(true);
    expect(filters.onlyWithBugs).toBe(true);

    const serialized = runnerFiltersToSearchParams(filters);
    expect(serialized.get("filters")).toBe("incomplete,ng,bugs");
  });

  it("clears category filters when switching to scenario mode", () => {
    const query = runnerFiltersToQuery({
      targetMode: "scenario",
      scenarioId: "smoke",
      ...defaultScopeFilters,
    });
    expect(query).toEqual({
      mode: "scenario",
      major: null,
      medium: null,
      minor: null,
      scenario: "smoke",
      filters: [],
    });
  });

  it("removes unknown test and bug ids for the active project", () => {
    const before = new URLSearchParams("test=TC-999&bug=BUG-999&major=Auth");
    const after = sanitizeRunnerSearchParams(definition, results, before);
    expect(after.get("test")).toBeNull();
    expect(after.get("bug")).toBeNull();
    expect(after.get("major")).toBe("Auth");
    expect(runnerSearchChanged(before, after)).toBe(true);
  });

  it("keeps valid test and bug ids", () => {
    const before = new URLSearchParams("test=TC-001&bug=BUG-001");
    const after = sanitizeRunnerSearchParams(definition, results, before);
    expect(after.get("test")).toBe("TC-001");
    expect(after.get("bug")).toBe("BUG-001");
    expect(runnerSearchChanged(before, after)).toBe(false);
  });

  it("removes only test id while preserving filter query params", () => {
    const before = new URLSearchParams("major=Auth&test=TC-999&filters=incomplete");
    const after = sanitizeRunnerSearchParams(definition, results, before);
    expect(after.get("test")).toBeNull();
    expect(after.get("major")).toBe("Auth");
    expect(after.get("filters")).toBe("incomplete");
  });

  it("removes only bug id while preserving test id", () => {
    const before = new URLSearchParams("test=TC-001&bug=BUG-999");
    const after = sanitizeRunnerSearchParams(definition, results, before);
    expect(after.get("test")).toBe("TC-001");
    expect(after.get("bug")).toBeNull();
  });

  it("leaves query unchanged when both ids are absent", () => {
    const before = new URLSearchParams("major=Auth&mode=filter");
    const after = sanitizeRunnerSearchParams(definition, results, before);
    expect(runnerSearchChanged(before, after)).toBe(false);
  });
});

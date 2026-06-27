import { describe, expect, it } from "vitest";
import {
  isRunnerFiltersSettled,
  parseRunnerSearchParams,
  queryToRunnerFilters,
  runnerFiltersToQuery,
  runnerFiltersToSearchParams,
  searchParamsToRunnerQuery,
} from "@/lib/runner-query";

describe("runner query roundtrip", () => {
  it("parses filter mode from URL", () => {
    const params = new URLSearchParams("major=Auth&medium=Login&incomplete=1&test=TC-001");
    const { filters, testId } = parseRunnerSearchParams(params);
    expect(filters).toEqual({
      targetMode: "filter",
      majorCategoryFilter: "Auth",
      mediumCategoryFilter: "Login",
      onlyIncomplete: true,
    });
    expect(testId).toBe("TC-001");
  });

  it("parses scenario mode from URL", () => {
    const query = searchParamsToRunnerQuery(new URLSearchParams("mode=scenario&scenario=smoke"));
    expect(queryToRunnerFilters(query)).toEqual({
      targetMode: "scenario",
      scenarioId: "smoke",
      onlyIncomplete: false,
    });
    expect(isRunnerFiltersSettled(queryToRunnerFilters(query))).toBe(true);
  });

  it("serializes filters back to search params", () => {
    const params = runnerFiltersToSearchParams(
      {
        targetMode: "filter",
        majorCategoryFilter: "Auth",
        onlyIncomplete: true,
      },
      "TC-002",
    );
    expect(params.get("major")).toBe("Auth");
    expect(params.get("incomplete")).toBe("1");
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
      onlyIncomplete: false,
    });
    expect(testId).toBe("TC-001");

    const serialized = runnerFiltersToSearchParams(filters, testId);
    expect(serialized.get("minor")).toBe("OAuth");
  });

  it("clears category filters when switching to scenario mode", () => {
    const query = runnerFiltersToQuery({
      targetMode: "scenario",
      scenarioId: "smoke",
      onlyIncomplete: false,
    });
    expect(query).toEqual({
      mode: "scenario",
      major: null,
      medium: null,
      minor: null,
      scenario: "smoke",
      incomplete: false,
    });
  });
});

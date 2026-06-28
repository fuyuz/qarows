import {
  parseAsBoolean,
  parseAsString,
  parseAsStringLiteral,
  type UrlKeys,
} from "nuqs";
import type { ResultsFile, RunnerFilters, RunnerTargetMode, TestDefinition } from "@qarows/shared";

export const defaultRunnerFilters: RunnerFilters = {
  targetMode: "filter",
  onlyIncomplete: false,
};

export const runnerQueryParsers = {
  mode: parseAsStringLiteral(["filter", "scenario"] as const).withDefault("filter"),
  major: parseAsString,
  medium: parseAsString,
  minor: parseAsString,
  scenario: parseAsString,
  incomplete: parseAsBoolean.withDefault(false),
  test: parseAsString,
  bug: parseAsString,
};

export type RunnerQueryState = {
  mode: RunnerTargetMode;
  major: string | null;
  medium: string | null;
  minor: string | null;
  scenario: string | null;
  incomplete: boolean;
  test: string | null;
  bug: string | null;
};

export function searchParamsToRunnerQuery(search: URLSearchParams): RunnerQueryState {
  const incompleteRaw = search.get("incomplete");
  return {
    mode: search.get("mode") === "scenario" ? "scenario" : "filter",
    major: search.get("major"),
    medium: search.get("medium"),
    minor: search.get("minor"),
    scenario: search.get("scenario"),
    incomplete: incompleteRaw === "1" || incompleteRaw === "true",
    test: search.get("test"),
    bug: search.get("bug"),
  };
}

export function parseRunnerSearchParams(search: URLSearchParams): {
  filters: RunnerFilters;
  testId: string | null;
  bugId: string | null;
} {
  const query = searchParamsToRunnerQuery(search);
  return {
    filters: queryToRunnerFilters(query),
    testId: query.test,
    bugId: query.bug,
  };
}

export function queryToRunnerFilters(query: RunnerQueryState): RunnerFilters {
  const targetMode = query.mode;
  if (targetMode === "scenario") {
    return {
      targetMode: "scenario",
      scenarioId: query.scenario ?? undefined,
      onlyIncomplete: query.incomplete,
    };
  }
  return {
    targetMode: "filter",
    majorCategoryFilter: query.major ?? undefined,
    mediumCategoryFilter: query.medium ?? undefined,
    minorCategoryFilter: query.minor ?? undefined,
    onlyIncomplete: query.incomplete,
  };
}

export function isRunnerFiltersSettled(filters: RunnerFilters): boolean {
  const mode = filters.targetMode ?? "filter";
  if (mode === "scenario") {
    return Boolean(filters.scenarioId);
  }
  return true;
}

export function runnerFiltersToQuery(
  filters: RunnerFilters,
): Pick<RunnerQueryState, "mode" | "major" | "medium" | "minor" | "scenario" | "incomplete"> {
  const mode = filters.targetMode ?? "filter";
  if (mode === "scenario") {
    return {
      mode: "scenario",
      major: null,
      medium: null,
      minor: null,
      scenario: filters.scenarioId ?? null,
      incomplete: filters.onlyIncomplete,
    };
  }
  return {
    mode: "filter",
    major: filters.majorCategoryFilter ?? null,
    medium: filters.mediumCategoryFilter ?? null,
    minor: filters.minorCategoryFilter ?? null,
    scenario: null,
    incomplete: filters.onlyIncomplete,
  };
}

export function runnerFiltersToSearchParams(
  filters?: RunnerFilters,
  testId?: string | null,
  bugId?: string | null,
): URLSearchParams {
  const params = new URLSearchParams();
  if (!filters) {
    if (testId) params.set("test", testId);
    if (bugId) params.set("bug", bugId);
    return params;
  }
  const query = runnerFiltersToQuery(filters);
  if (query.mode !== defaultRunnerFilters.targetMode) params.set("mode", query.mode);
  if (query.major) params.set("major", query.major);
  if (query.medium) params.set("medium", query.medium);
  if (query.minor) params.set("minor", query.minor);
  if (query.scenario) params.set("scenario", query.scenario);
  if (query.incomplete) params.set("incomplete", "1");
  if (testId) params.set("test", testId);
  if (bugId) params.set("bug", bugId);
  return params;
}

/** Removes test/bug query keys that do not exist in the active project. */
export function sanitizeRunnerSearchParams(
  definition: TestDefinition,
  results: ResultsFile,
  search: URLSearchParams,
): URLSearchParams {
  const next = new URLSearchParams(search);
  const testId = next.get("test");
  if (testId && !definition.testCases.some((tc) => tc.id === testId)) {
    next.delete("test");
  }
  const bugId = next.get("bug");
  if (bugId && !results.bugs.some((bug) => bug.id === bugId)) {
    next.delete("bug");
  }
  return next;
}

export function runnerSearchChanged(
  before: URLSearchParams,
  after: URLSearchParams,
): boolean {
  return before.toString() !== after.toString();
}

export const runnerQueryKeys = {
  mode: "mode",
  major: "major",
  medium: "medium",
  minor: "minor",
  scenario: "scenario",
  incomplete: "incomplete",
  test: "test",
  bug: "bug",
} satisfies UrlKeys<typeof runnerQueryParsers>;

import {
  parseAsBoolean,
  parseAsString,
  parseAsStringLiteral,
  type UrlKeys,
} from "nuqs";
import type { RunnerFilters, RunnerTargetMode } from "@qarows/shared";

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
};

export type RunnerQueryState = {
  mode: RunnerTargetMode;
  major: string | null;
  medium: string | null;
  minor: string | null;
  scenario: string | null;
  incomplete: boolean;
  test: string | null;
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
  };
}

export function parseRunnerSearchParams(search: URLSearchParams): {
  filters: RunnerFilters;
  testId: string | null;
} {
  const query = searchParamsToRunnerQuery(search);
  return {
    filters: queryToRunnerFilters(query),
    testId: query.test,
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
): URLSearchParams {
  const params = new URLSearchParams();
  if (!filters) {
    if (testId) params.set("test", testId);
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
  return params;
}

export const runnerQueryKeys = {
  mode: "mode",
  major: "major",
  medium: "medium",
  minor: "minor",
  scenario: "scenario",
  incomplete: "incomplete",
  test: "test",
} satisfies UrlKeys<typeof runnerQueryParsers>;

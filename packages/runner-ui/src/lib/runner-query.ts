import {
  parseAsArrayOf,
  parseAsString,
  parseAsStringLiteral,
  type UrlKeys,
} from "nuqs";
import type { ResultsFile, RunnerFilters, RunnerTargetMode, TestDefinition } from "@qarows/shared";

export const RUNNER_SCOPE_FILTER_VALUES = ["incomplete", "ng", "bugs"] as const;
export type RunnerScopeFilterToken = (typeof RUNNER_SCOPE_FILTER_VALUES)[number];

export const defaultRunnerFilters: RunnerFilters = {
  targetMode: "filter",
  onlyIncomplete: false,
  onlyWithBugs: false,
  onlyWithNg: false,
};

export const runnerQueryParsers = {
  mode: parseAsStringLiteral(["filter", "scenario"] as const).withDefault("filter"),
  major: parseAsString,
  medium: parseAsString,
  minor: parseAsString,
  scenario: parseAsString,
  filters: parseAsArrayOf(parseAsStringLiteral(RUNNER_SCOPE_FILTER_VALUES)).withDefault([]),
  test: parseAsString,
  bug: parseAsString,
};

export type RunnerQueryState = {
  mode: RunnerTargetMode;
  major: string | null;
  medium: string | null;
  minor: string | null;
  scenario: string | null;
  filters: RunnerScopeFilterToken[];
  test: string | null;
  bug: string | null;
};

function isRunnerScopeFilterToken(value: string): value is RunnerScopeFilterToken {
  return (RUNNER_SCOPE_FILTER_VALUES as readonly string[]).includes(value);
}

export function parseScopeFilterTokens(search: URLSearchParams): RunnerScopeFilterToken[] {
  const raw = search.get("filters");
  if (raw) {
    return [...new Set(raw.split(",").filter(isRunnerScopeFilterToken))];
  }

  const legacy: RunnerScopeFilterToken[] = [];
  const incompleteRaw = search.get("incomplete");
  if (incompleteRaw === "1" || incompleteRaw === "true") legacy.push("incomplete");
  const withNgRaw = search.get("withNg");
  if (withNgRaw === "1" || withNgRaw === "true") legacy.push("ng");
  const withBugsRaw = search.get("withBugs");
  if (withBugsRaw === "1" || withBugsRaw === "true") legacy.push("bugs");
  return legacy;
}

export function scopeFilterTokensToFlags(tokens: readonly RunnerScopeFilterToken[]): {
  onlyIncomplete: boolean;
  onlyWithBugs: boolean;
  onlyWithNg: boolean;
} {
  const set = new Set(tokens);
  return {
    onlyIncomplete: set.has("incomplete"),
    onlyWithBugs: set.has("bugs"),
    onlyWithNg: set.has("ng"),
  };
}

export function runnerFiltersToScopeTokens(filters: RunnerFilters): RunnerScopeFilterToken[] {
  const tokens: RunnerScopeFilterToken[] = [];
  if (filters.onlyIncomplete) tokens.push("incomplete");
  if (filters.onlyWithNg) tokens.push("ng");
  if (filters.onlyWithBugs) tokens.push("bugs");
  return tokens;
}

export function searchParamsToRunnerQuery(search: URLSearchParams): RunnerQueryState {
  return {
    mode: search.get("mode") === "scenario" ? "scenario" : "filter",
    major: search.get("major"),
    medium: search.get("medium"),
    minor: search.get("minor"),
    scenario: search.get("scenario"),
    filters: parseScopeFilterTokens(search),
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
  const scopeFlags = scopeFilterTokensToFlags(query.filters);
  const targetMode = query.mode;
  if (targetMode === "scenario") {
    return {
      targetMode: "scenario",
      scenarioId: query.scenario ?? undefined,
      ...scopeFlags,
    };
  }
  return {
    targetMode: "filter",
    majorCategoryFilter: query.major ?? undefined,
    mediumCategoryFilter: query.medium ?? undefined,
    minorCategoryFilter: query.minor ?? undefined,
    ...scopeFlags,
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
): Pick<RunnerQueryState, "mode" | "major" | "medium" | "minor" | "scenario" | "filters"> {
  const mode = filters.targetMode ?? "filter";
  const scopeTokens = runnerFiltersToScopeTokens(filters);
  if (mode === "scenario") {
    return {
      mode: "scenario",
      major: null,
      medium: null,
      minor: null,
      scenario: filters.scenarioId ?? null,
      filters: scopeTokens,
    };
  }
  return {
    mode: "filter",
    major: filters.majorCategoryFilter ?? null,
    medium: filters.mediumCategoryFilter ?? null,
    minor: filters.minorCategoryFilter ?? null,
    scenario: null,
    filters: scopeTokens,
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
  if (query.filters.length > 0) params.set("filters", query.filters.join(","));
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
  filters: "filters",
  test: "test",
  bug: "bug",
} satisfies UrlKeys<typeof runnerQueryParsers>;

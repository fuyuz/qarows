import { useCallback, useMemo } from "react";
import { useSearchParams } from "react-router-dom";
import { useQueryStates } from "nuqs";
import type { RunnerFilters } from "@qarows/shared";
import {
  isRunnerFiltersSettled,
  parseRunnerSearchParams,
  queryToRunnerFilters,
  runnerFiltersToQuery,
  runnerQueryParsers,
} from "@/lib/runner-query";

function nuqsToRunnerFilters(query: {
  mode: "filter" | "scenario";
  major: string | null;
  medium: string | null;
  minor: string | null;
  scenario: string | null;
  incomplete: boolean;
}): RunnerFilters {
  return queryToRunnerFilters({
    mode: query.mode,
    major: query.major,
    medium: query.medium,
    minor: query.minor,
    scenario: query.scenario,
    incomplete: query.incomplete,
    test: null,
  });
}

export function useRunnerQueryState() {
  const [searchParams] = useSearchParams();
  const urlState = useMemo(
    () => parseRunnerSearchParams(searchParams),
    [searchParams],
  );
  const [query, setQuery] = useQueryStates(runnerQueryParsers, { history: "replace" });

  const runnerFilters = useMemo(() => {
    const fromNuqs = nuqsToRunnerFilters(query);
    if (isRunnerFiltersSettled(fromNuqs)) return fromNuqs;
    if (isRunnerFiltersSettled(urlState.filters)) return urlState.filters;
    return fromNuqs;
  }, [query, urlState.filters]);

  const testId = query.test ?? urlState.testId;
  const filtersSettled = useMemo(() => isRunnerFiltersSettled(runnerFilters), [runnerFilters]);

  const setRunnerFilters = useCallback(
    (filters: RunnerFilters, options?: { testId?: string | null; keepTest?: boolean }) => {
      void setQuery({
        ...runnerFiltersToQuery(filters),
        test: options?.keepTest ? (query.test ?? urlState.testId) : (options?.testId ?? null),
      });
    },
    [query.test, setQuery, urlState.testId],
  );

  const setTestId = useCallback(
    (nextTestId: string | null) => {
      void setQuery({ test: nextTestId });
    },
    [setQuery],
  );

  return {
    runnerFilters,
    filtersSettled,
    testId,
    setRunnerFilters,
    setTestId,
    setQuery,
  };
}

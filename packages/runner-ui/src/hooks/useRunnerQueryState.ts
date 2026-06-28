import { useCallback, useMemo } from "react";
import { useSearchParams } from "react-router-dom";
import { useQueryStates } from "nuqs";
import type { BugSeverity, BugStatus, RunnerFilters } from "@qarows/shared";
import {
  bugFilterTokensToBugFilters,
  bugFiltersToTokens,
  bugQueryParsers,
  type BugFilterToken,
} from "../lib/bug-query";
import {
  isRunnerFiltersSettled,
  parseRunnerSearchParams,
  queryToRunnerFilters,
  runnerFiltersToQuery,
  runnerQueryParsers,
} from "../lib/runner-query";

function nuqsToRunnerFilters(query: {
  mode: "filter" | "scenario";
  major: string | null;
  medium: string | null;
  minor: string | null;
  scenario: string | null;
  filters: ReturnType<typeof runnerFiltersToQuery>["filters"];
}): RunnerFilters {
  return queryToRunnerFilters({
    mode: query.mode,
    major: query.major,
    medium: query.medium,
    minor: query.minor,
    scenario: query.scenario,
    filters: query.filters,
    test: null,
    bug: null,
  });
}

export function useRunnerQueryState() {
  const [searchParams] = useSearchParams();
  const urlState = useMemo(
    () => parseRunnerSearchParams(searchParams),
    [searchParams],
  );
  const [query, setQuery] = useQueryStates(
    { ...runnerQueryParsers, ...bugQueryParsers },
    { history: "replace" },
  );

  const runnerFilters = useMemo(() => {
    const fromNuqs = nuqsToRunnerFilters(query);
    if (isRunnerFiltersSettled(fromNuqs)) return fromNuqs;
    if (isRunnerFiltersSettled(urlState.filters)) return urlState.filters;
    return fromNuqs;
  }, [query, urlState.filters]);

  const testId = query.test ?? urlState.testId;
  const bugId = query.bug ?? urlState.bugId;
  const filtersSettled = useMemo(() => isRunnerFiltersSettled(runnerFilters), [runnerFilters]);

  const setRunnerFilters = useCallback(
    (filters: RunnerFilters, options?: { testId?: string | null; bugId?: string | null; keepTest?: boolean; keepBug?: boolean }) => {
      void setQuery({
        ...runnerFiltersToQuery(filters),
        test: options?.keepTest ? (query.test ?? urlState.testId) : (options?.testId ?? null),
        bug: options?.keepBug ? (query.bug ?? urlState.bugId) : (options?.bugId ?? null),
        bugFilters: query.bugFilters,
      });
    },
    [query.bug, query.bugFilters, query.test, setQuery, urlState.bugId, urlState.testId],
  );

  const setTestId = useCallback(
    (nextTestId: string | null) => {
      void setQuery({ test: nextTestId });
    },
    [setQuery],
  );

  const setBugId = useCallback(
    (nextBugId: string | null) => {
      void setQuery({ bug: nextBugId });
    },
    [setQuery],
  );

  const bugFilters = useMemo(
    () => bugFilterTokensToBugFilters(query.bugFilters),
    [query.bugFilters],
  );

  const toggleBugFilterToken = useCallback(
    (token: BugFilterToken) => {
      const current = query.bugFilters;
      const next = current.includes(token)
        ? current.filter((value) => value !== token)
        : [...current, token];
      void setQuery({ bugFilters: next });
    },
    [query.bugFilters, setQuery],
  );

  const toggleBugPriority = useCallback(
    (priority: BugSeverity) => {
      toggleBugFilterToken(priority);
    },
    [toggleBugFilterToken],
  );

  const toggleBugStatus = useCallback(
    (status: BugStatus) => {
      toggleBugFilterToken(status);
    },
    [toggleBugFilterToken],
  );

  const setBugFilters = useCallback(
    (filters: { priorities: BugSeverity[]; statuses: BugStatus[] }) => {
      void setQuery({ bugFilters: bugFiltersToTokens(filters) });
    },
    [setQuery],
  );

  return {
    runnerFilters,
    filtersSettled,
    testId,
    bugId,
    bugFilters,
    setRunnerFilters,
    setTestId,
    setBugId,
    toggleBugPriority,
    toggleBugStatus,
    setBugFilters,
    setQuery,
  };
}

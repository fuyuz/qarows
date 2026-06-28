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
} from "../lib/runner-query";
import { bugQueryParsers } from "../lib/bug-query";
import type { BugSeverity, BugStatus } from "@qarows/shared";

function nuqsToRunnerFilters(query: {
  mode: "filter" | "scenario";
  major: string | null;
  medium: string | null;
  minor: string | null;
  scenario: string | null;
  incomplete: boolean;
  withBugs: boolean;
  withNg: boolean;
}): RunnerFilters {
  return queryToRunnerFilters({
    mode: query.mode,
    major: query.major,
    medium: query.medium,
    minor: query.minor,
    scenario: query.scenario,
    incomplete: query.incomplete,
    withBugs: query.withBugs,
    withNg: query.withNg,
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
        priority: query.priority,
        status: query.status,
      });
    },
    [query.bug, query.priority, query.status, query.test, setQuery, urlState.bugId, urlState.testId],
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
    () => ({
      priorities: query.priority,
      statuses: query.status,
    }),
    [query.priority, query.status],
  );

  const toggleBugPriority = useCallback(
    (priority: BugSeverity) => {
      const current = query.priority;
      const next = current.includes(priority)
        ? current.filter((value) => value !== priority)
        : [...current, priority];
      void setQuery({ priority: next });
    },
    [query.priority, setQuery],
  );

  const toggleBugStatus = useCallback(
    (status: BugStatus) => {
      const current = query.status;
      const next = current.includes(status)
        ? current.filter((value) => value !== status)
        : [...current, status];
      void setQuery({ status: next });
    },
    [query.status, setQuery],
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
    setQuery,
  };
}

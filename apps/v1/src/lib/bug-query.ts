import { parseAsArrayOf, parseAsStringLiteral } from "nuqs";
import type { BugSeverity, BugStatus } from "@qarows/shared";

export const BUG_SEVERITY_VALUES = ["low", "medium", "high", "critical"] as const satisfies readonly BugSeverity[];
export const BUG_STATUS_VALUES = [
  "open",
  "in_progress",
  "fixed",
  "resolved",
  "wont_fix",
] as const satisfies readonly BugStatus[];

export const BUG_FILTER_VALUES = [...BUG_STATUS_VALUES, ...BUG_SEVERITY_VALUES] as const;
export type BugFilterToken = (typeof BUG_FILTER_VALUES)[number];

export interface BugFilters {
  priorities: BugSeverity[];
  statuses: BugStatus[];
}

export const bugQueryParsers = {
  bugFilters: parseAsArrayOf(parseAsStringLiteral(BUG_FILTER_VALUES)).withDefault([]),
};

function isBugStatusToken(value: string): value is BugStatus {
  return (BUG_STATUS_VALUES as readonly string[]).includes(value);
}

function isBugSeverityToken(value: string): value is BugSeverity {
  return (BUG_SEVERITY_VALUES as readonly string[]).includes(value);
}

function isBugFilterToken(value: string): value is BugFilterToken {
  return isBugStatusToken(value) || isBugSeverityToken(value);
}

export function parseBugFilterTokens(search: URLSearchParams): BugFilterToken[] {
  const raw = search.get("bugFilters");
  if (raw) {
    return [...new Set(raw.split(",").filter(isBugFilterToken))];
  }

  const legacy = [
    ...search
      .getAll("status")
      .flatMap((value) => value.split(","))
      .filter(isBugStatusToken),
    ...search
      .getAll("priority")
      .flatMap((value) => value.split(","))
      .filter(isBugSeverityToken),
  ];
  return [...new Set(legacy)];
}

export function bugFilterTokensToBugFilters(tokens: readonly BugFilterToken[]): BugFilters {
  const priorities: BugSeverity[] = [];
  const statuses: BugStatus[] = [];
  for (const token of tokens) {
    if (isBugSeverityToken(token)) {
      priorities.push(token);
    } else if (isBugStatusToken(token)) {
      statuses.push(token);
    }
  }
  return { priorities, statuses };
}

export function bugFiltersToTokens(filters: BugFilters): BugFilterToken[] {
  return [...filters.statuses, ...filters.priorities];
}

export function parseBugFilters(search: URLSearchParams): BugFilters {
  return bugFilterTokensToBugFilters(parseBugFilterTokens(search));
}

export function bugFiltersToSearchParams(filters: BugFilters): URLSearchParams {
  const params = new URLSearchParams();
  const tokens = bugFiltersToTokens(filters);
  if (tokens.length > 0) {
    params.set("bugFilters", tokens.join(","));
  }
  return params;
}

export function matchesBugFilters(bug: { severity: BugSeverity; status: BugStatus }, filters: BugFilters): boolean {
  if (filters.priorities.length > 0 && !filters.priorities.includes(bug.severity)) {
    return false;
  }
  if (filters.statuses.length > 0 && !filters.statuses.includes(bug.status)) {
    return false;
  }
  return true;
}

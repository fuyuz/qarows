import { parseAsArrayOf, parseAsStringLiteral } from "nuqs";
import type { BugSeverity, BugStatus } from "@qarows/shared";

export const BUG_SEVERITY_VALUES = ["low", "medium", "high", "critical"] as const satisfies readonly BugSeverity[];
export const BUG_STATUS_VALUES = [
  "open",
  "in_progress",
  "fixed",
  "pending_verification",
  "resolved",
] as const satisfies readonly BugStatus[];

export interface BugFilters {
  priorities: BugSeverity[];
  statuses: BugStatus[];
}

export const bugQueryParsers = {
  priority: parseAsArrayOf(parseAsStringLiteral(BUG_SEVERITY_VALUES)).withDefault([]),
  status: parseAsArrayOf(parseAsStringLiteral(BUG_STATUS_VALUES)).withDefault([]),
};

export function parseBugFilters(search: URLSearchParams): BugFilters {
  const priorities = search
    .getAll("priority")
    .flatMap((value) => value.split(","))
    .filter((value): value is BugSeverity =>
      (BUG_SEVERITY_VALUES as readonly string[]).includes(value),
    );
  const statuses = search
    .getAll("status")
    .flatMap((value) => value.split(","))
    .filter((value): value is BugStatus =>
      (BUG_STATUS_VALUES as readonly string[]).includes(value),
    );
  return { priorities, statuses };
}

export function bugFiltersToSearchParams(filters: BugFilters): URLSearchParams {
  const params = new URLSearchParams();
  if (filters.priorities.length > 0) {
    params.set("priority", filters.priorities.join(","));
  }
  if (filters.statuses.length > 0) {
    params.set("status", filters.statuses.join(","));
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

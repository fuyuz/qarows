import { describe, expect, it } from "vitest";
import {
  bugFiltersToSearchParams,
  bugFiltersToTokens,
  matchesBugFilters,
  parseBugFilterTokens,
  parseBugFilters,
} from "@/lib/bug-query";
import type { BugSeverity, BugStatus } from "@qarows/shared";

describe("bug query", () => {
  it("parses bug filter tokens from URL", () => {
    const filters = parseBugFilters(new URLSearchParams("bugFilters=open,fixed,high,critical"));
    expect(filters).toEqual({
      priorities: ["high", "critical"],
      statuses: ["open", "fixed"],
    });
  });

  it("parses legacy priority and status params", () => {
    const tokens = parseBugFilterTokens(new URLSearchParams("priority=high,critical&status=open"));
    expect(tokens).toEqual(["open", "high", "critical"]);
  });

  it("roundtrips through search params", () => {
    const original = {
      priorities: ["medium"] as BugSeverity[],
      statuses: ["fixed", "resolved"] as BugStatus[],
    };
    expect(bugFiltersToTokens(original)).toEqual(["fixed", "resolved", "medium"]);
    const reparsed = parseBugFilters(bugFiltersToSearchParams(original));
    expect(reparsed.priorities).toEqual(["medium"]);
    expect(reparsed.statuses).toEqual(["fixed", "resolved"]);
  });

  it("matches OR filters within each dimension", () => {
    const bug = { severity: "high" as const, status: "open" as const };
    expect(matchesBugFilters(bug, { priorities: ["high"], statuses: [] })).toBe(true);
    expect(matchesBugFilters(bug, { priorities: ["low"], statuses: [] })).toBe(false);
    expect(matchesBugFilters(bug, { priorities: [], statuses: [] })).toBe(true);
  });
});

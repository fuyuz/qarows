import { describe, expect, it } from "vitest";
import {
  bugFiltersToSearchParams,
  matchesBugFilters,
  parseBugFilters,
} from "@/lib/bug-query";
import type { BugSeverity, BugStatus } from "@qarows/shared";

describe("bug query", () => {
  it("parses priority and status filters from URL", () => {
    const filters = parseBugFilters(new URLSearchParams("priority=high,critical&status=open"));
    expect(filters).toEqual({
      priorities: ["high", "critical"],
      statuses: ["open"],
    });
  });

  it("roundtrips through search params", () => {
    const original = {
      priorities: ["medium"] as BugSeverity[],
      statuses: ["fixed", "resolved"] as BugStatus[],
    };
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

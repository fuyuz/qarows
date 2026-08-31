import { describe, expect, it } from "vitest";
import { resolveFilteredBugs } from "./bug-filter";
import { makeDefinition } from "@qarows/shared/test-fixtures";
import type { Bug } from "@qarows/shared";

const defaultScopeFilters = { onlyIncomplete: false, onlyWithBugs: false, onlyWithNg: false };

describe("resolveFilteredBugs", () => {
  const definition = makeDefinition();
  const bugs: Bug[] = [
    {
      id: "BUG-001",
      title: "Auth bug",
      severity: "high",
      status: "open",
      testCaseId: "TC-001",
    },
    {
      id: "BUG-002",
      title: "Billing bug",
      severity: "medium",
      status: "open",
      testCaseId: "TC-003",
    },
    { id: "BUG-003", title: "Unlinked", severity: "low", status: "open" },
  ];

  it("filters bugs by test case scope and major category", () => {
    const filtered = resolveFilteredBugs(
      definition,
      { ...defaultScopeFilters, majorCategoryFilter: "Auth" },
      bugs,
      {},
      definition.environments.map((env) => env.id),
    );
    expect(filtered.map((bug) => bug.id)).toEqual(["BUG-001"]);
  });

  it("includes unlinked bugs when no category filter is active", () => {
    const filtered = resolveFilteredBugs(
      definition,
      defaultScopeFilters,
      bugs,
      {},
      definition.environments.map((env) => env.id),
    );
    expect(filtered.map((bug) => bug.id)).toEqual(["BUG-001", "BUG-002", "BUG-003"]);
  });

  it("filters by bug severity", () => {
    const filtered = resolveFilteredBugs(
      definition,
      defaultScopeFilters,
      bugs,
      {},
      definition.environments.map((env) => env.id),
      { priorities: ["high"], statuses: [] },
    );
    expect(filtered.map((bug) => bug.id)).toEqual(["BUG-001"]);
  });

  it("filters by bug status", () => {
    const scopedBugs: Bug[] = [
      { id: "BUG-001", title: "Open", severity: "high", status: "open" },
      { id: "BUG-002", title: "Fixed", severity: "medium", status: "fixed" },
    ];
    const filtered = resolveFilteredBugs(
      definition,
      defaultScopeFilters,
      scopedBugs,
      {},
      definition.environments.map((env) => env.id),
      { priorities: [], statuses: ["fixed"] },
    );
    expect(filtered.map((bug) => bug.id)).toEqual(["BUG-002"]);
  });

  it("keeps bugs on test cases outside the current device selection", () => {
    const scopedDefinition = makeDefinition({
      testCases: [
        {
          id: "TC-001",
          category: { major: "Auth", medium: "Login" },
          description: "Can log in",
          targetEnvironments: { required: "all", targets: ["safari"] },
        },
      ],
    });
    const filtered = resolveFilteredBugs(
      scopedDefinition,
      defaultScopeFilters,
      [bugs[0]!],
      {},
      scopedDefinition.environments.map((env) => env.id),
    );
    expect(filtered.map((bug) => bug.id)).toEqual(["BUG-001"]);
  });
});

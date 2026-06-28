import { describe, expect, it } from "vitest";
import { createEmptyResults } from "./parse-results";
import { makeDefinition } from "./test-fixtures";
import {
  reconcileResultsOnDefinitionReplace,
  sanitizeSessionOnDefinitionReplace,
} from "./reconcile-on-definition-replace";

describe("reconcileResultsOnDefinitionReplace", () => {
  it("keeps results for test cases and environments that still exist", () => {
    const definition = makeDefinition();
    const results = createEmptyResults("test");
    results.results = {
      "TC-001": {
        chrome: { status: "OK", executedAt: "2026-06-28T12:00:00.000Z" },
      },
      "TC-999": {
        chrome: { status: "NG" },
      },
    };
    results.bugs = [
      {
        id: "BUG-001",
        title: "Still valid",
        severity: "medium",
        status: "open",
        testCaseId: "TC-001",
        environmentIds: ["chrome"],
      },
      {
        id: "BUG-002",
        title: "Removed test",
        severity: "low",
        status: "open",
        testCaseId: "TC-999",
      },
    ];

    const nextDefinition = makeDefinition({
      testCases: definition.testCases.filter((tc) => tc.id !== "TC-003"),
    });
    const reconciled = reconcileResultsOnDefinitionReplace(results, nextDefinition);

    expect(reconciled.results["TC-001"]?.chrome?.status).toBe("OK");
    expect(reconciled.results["TC-999"]).toBeUndefined();
    expect(reconciled.bugs).toHaveLength(1);
    expect(reconciled.bugs[0]?.id).toBe("BUG-001");
  });

  it("drops results for removed environments", () => {
    const definition = makeDefinition({
      environments: [{ id: "chrome", name: "Chrome" }],
    });
    const results = createEmptyResults("test");
    results.results = {
      "TC-001": {
        chrome: { status: "OK" },
        firefox: { status: "NG" },
      },
    };

    const reconciled = reconcileResultsOnDefinitionReplace(results, definition);
    expect(reconciled.results["TC-001"]?.chrome?.status).toBe("OK");
    expect(reconciled.results["TC-001"]?.firefox).toBeUndefined();
  });
});

describe("sanitizeSessionOnDefinitionReplace", () => {
  it("removes unknown environment ids", () => {
    const definition = makeDefinition({
      environments: [{ id: "chrome", name: "Chrome" }],
    });
    const session = {
      executorName: "Alice",
      selectedEnvironmentIds: ["chrome", "removed-env"],
    };

    expect(sanitizeSessionOnDefinitionReplace(session, definition)).toEqual({
      executorName: "Alice",
      selectedEnvironmentIds: ["chrome"],
    });
  });

  it("returns null when no valid environments remain", () => {
    const definition = makeDefinition({
      environments: [{ id: "chrome", name: "Chrome" }],
    });
    const session = {
      executorName: "Alice",
      selectedEnvironmentIds: ["removed-env"],
    };

    expect(sanitizeSessionOnDefinitionReplace(session, definition)).toBeNull();
  });
});

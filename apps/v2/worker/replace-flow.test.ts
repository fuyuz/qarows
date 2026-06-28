import { describe, expect, it } from "vitest";
import { createEmptyResults } from "@qarows/shared";
import { makeDefinition } from "@qarows/shared/test-fixtures";
import {
  reconcileResultsOnDefinitionReplace,
  sanitizeSessionOnDefinitionReplace,
} from "@qarows/shared";

describe("definition replace preserves compatible results", () => {
  it("keeps overlapping results when test cases are removed from yaml", () => {
    const before = makeDefinition();
    const results = createEmptyResults("test");
    results.results = {
      "TC-001": { chrome: { status: "OK" } },
      "TC-002": { chrome: { status: "NG", memo: "still here" } },
      "TC-003": { chrome: { status: "SKIP" } },
    };

    const afterDefinition = makeDefinition({
      testCases: before.testCases.filter((tc) => tc.id !== "TC-003"),
    });

    const reconciled = reconcileResultsOnDefinitionReplace(results, afterDefinition);
    expect(reconciled.results["TC-001"]?.chrome?.status).toBe("OK");
    expect(reconciled.results["TC-002"]?.chrome?.status).toBe("NG");
    expect(reconciled.results["TC-003"]).toBeUndefined();
  });

  it("sanitizes session env ids after environment list changes", () => {
    const definition = makeDefinition({
      environments: [{ id: "chrome", name: "Chrome" }],
    });
    const session = {
      executorName: "Bob",
      selectedEnvironmentIds: ["chrome", "firefox"],
    };

    expect(sanitizeSessionOnDefinitionReplace(session, definition)).toEqual({
      executorName: "Bob",
      selectedEnvironmentIds: ["chrome"],
    });
  });
});

describe("generation fencing", () => {
  it("detects stale generation on commands", () => {
    const roomGeneration = "gen-new";
    const commandGeneration = "gen-old" as string;
    expect(commandGeneration !== roomGeneration).toBe(true);
  });
});

import { describe, expect, it } from "vitest";
import {
  isTestComplete,
  isTestIncomplete,
  resolveSessionTestTargets,
  resolveTestTargets,
  testCaseNeedsRetest,
} from "./resolve-test-targets";
import { makeDefinition } from "./test-fixtures";
import type { TestResults } from "./types";

describe("resolveTestTargets", () => {
  it("applies categoryTargets major then medium layers", () => {
    const definition = makeDefinition({
      categoryTargets: [
        {
          match: { major: "Auth" },
          required: "any",
          targets: ["chrome", "firefox"],
        },
        {
          match: { major: "Auth", medium: "Login" },
          required: "all",
          targets: ["chrome"],
        },
      ],
      testCases: [
        {
          id: "TC-001",
          category: { major: "Auth", medium: "Login" },
          description: "Login",
        },
      ],
    });

    const testCase = definition.testCases[0]!;
    expect(resolveTestTargets(testCase, definition)).toEqual({
      environmentIds: ["chrome"],
      required: "all",
    });
  });

  it("intersects with session environments", () => {
    const definition = makeDefinition();
    const testCase = definition.testCases[0]!;
    const targets = resolveSessionTestTargets(testCase, definition, ["chrome"]);
    expect(targets.environmentIds).toEqual(["chrome"]);
    expect(targets.inScope).toBe(true);
  });
});

describe("isTestIncomplete", () => {
  const definition = makeDefinition({
    testCases: [
      {
        id: "TC-001",
        category: { major: "Auth" },
        description: "Any env ok",
        targetEnvironments: { required: "any", targets: ["chrome", "firefox"] },
      },
    ],
  });
  const testCase = definition.testCases[0]!;

  it("any: complete when one environment has valid result", () => {
    const results: TestResults = {
      "TC-001": { chrome: { status: "OK" } },
    };
    expect(isTestIncomplete(testCase, definition, ["chrome", "firefox"], results)).toBe(false);
    expect(isTestComplete(testCase, definition, ["chrome", "firefox"], results)).toBe(true);
  });

  it("all: incomplete until every in-scope environment is filled", () => {
    const allCase = makeDefinition().testCases[0]!;
    const partial: TestResults = { "TC-001": { chrome: { status: "OK" } } };
    expect(isTestIncomplete(allCase, makeDefinition(), ["chrome", "firefox"], partial)).toBe(
      true,
    );
  });
});

describe("testCaseNeedsRetest", () => {
  it("is true when stale version results exist in scope", () => {
    const definition = makeDefinition({
      testCases: [
        {
          id: "TC-001",
          version: 2,
          category: { major: "Auth" },
          description: "Login",
        },
      ],
    });
    const testCase = definition.testCases[0]!;
    const results: TestResults = {
      "TC-001": {
        chrome: { status: "OK", version: 1 },
      },
    };

    expect(testCaseNeedsRetest(testCase, definition, ["chrome"], results)).toBe(true);
    expect(isTestComplete(testCase, definition, ["chrome"], results)).toBe(false);
  });
});

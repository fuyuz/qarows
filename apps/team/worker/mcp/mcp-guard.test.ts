import { describe, expect, it } from "vitest";
import { makeDefinition } from "@qarows/shared/test-fixtures";
import { MCP_ALLOWED_COMMAND_TYPES, assertMcpAllowedCommand } from "./server";
import {
  DefinitionEditError,
  addTestCase,
  deleteEnvironment,
  deleteTestCase,
  setOverview,
  updateTestCase,
} from "./definition-edits";

describe("MCP command guard", () => {
  it.each(["clearResults", "mergeResults", "replaceSnapshot", "replaceDefinition", "setSession", "updateResultsBatch"])(
    "rejects %s",
    (type) => {
      expect(() => assertMcpAllowedCommand({ type })).toThrow(/not allowed/);
    },
  );

  it("allows only result, memo and bug commands", () => {
    expect([...MCP_ALLOWED_COMMAND_TYPES].sort()).toEqual(
      ["addBug", "clearTestResult", "updateBug", "updateResult", "updateTestMemo"].sort(),
    );
  });
});

describe("MCP definition edits", () => {
  const base = makeDefinition({
    categoryTargets: [{ match: { major: "Auth" }, required: "any", targets: ["safari"] }],
    scenarios: [{ id: "s1", name: "S1", steps: ["TC-001", "TC-002"] }],
  });

  it("adds a test case and rejects a duplicate id or unknown target", () => {
    const next = addTestCase(base, { id: "TC-010", category: { major: "New" }, description: "Works" });
    expect(next.testCases.at(-1)).toEqual({ id: "TC-010", category: { major: "New" }, description: "Works" });
    expect(() => addTestCase(base, { id: "TC-001", category: { major: "x" }, description: "x" })).toThrow(
      DefinitionEditError,
    );
    expect(() =>
      addTestCase(base, {
        id: "TC-011",
        category: { major: "x" },
        description: "x",
        targetEnvironments: { required: "all", targets: ["nope"] },
      }),
    ).toThrow(/Unknown environment/);
  });

  it("updates fields, bumps the version and never changes the id", () => {
    const next = updateTestCase(base, "TC-001", { prerequisites: "Signed out", bumpVersion: true });
    const tc = next.testCases.find((t) => t.id === "TC-001");
    expect(tc).toMatchObject({ id: "TC-001", prerequisites: "Signed out", version: 2 });
  });

  it("removes a deleted test case from scenarios", () => {
    const next = deleteTestCase(base, "TC-001");
    expect(next.testCases.map((t) => t.id)).toEqual(["TC-002", "TC-003"]);
    expect(next.scenarios?.[0]?.steps).toEqual(["TC-002"]);
  });

  it("strips a deleted environment from targets but keeps the category rule", () => {
    const withTargets = updateTestCase(base, "TC-002", {
      targetEnvironments: { required: "all", targets: ["safari"] },
    });
    const next = deleteEnvironment(withTargets, "safari");
    expect(next.environments.map((e) => e.id)).toEqual(["chrome", "firefox"]);
    expect(next.testCases.find((t) => t.id === "TC-002")?.targetEnvironments).toBeUndefined();
    expect(next.categoryTargets).toEqual([{ match: { major: "Auth" }, required: "any" }]);
  });

  it("sets and clears the overview", () => {
    expect(setOverview(base, "## Hi").overview).toBe("## Hi");
    expect("overview" in setOverview({ ...base, overview: "x" }, "  ")).toBe(false);
  });
});

import { describe, expect, it } from "vitest";
import type { TestDefinition } from "@qarows/shared";
import { applyDefinitionPatch, parseDefinitionPatch } from "./apply-patches";

const base: TestDefinition = {
  project: { name: "demo", id: "demo" },
  environments: [
    { id: "web", name: "Web" },
    { id: "ios", name: "iOS" },
  ],
  testCases: [
    {
      id: "TC-001",
      category: { major: "A" },
      description: "existing",
    },
  ],
};

describe("parseDefinitionPatch", () => {
  it("parses nested patch", () => {
    const patch = parseDefinitionPatch({
      patch: {
        testCases: {
          added: [{ id: "TC-002", category: { major: "B" }, description: "new" }],
          removed: ["TC-001"],
        },
        environments: {
          modified: [{ id: "ios", name: "iOS 18" }],
        },
      },
    });
    expect(patch.testCases?.added).toHaveLength(1);
    expect(patch.testCases?.removed).toEqual(["TC-001"]);
    expect(patch.environments?.modified?.[0]?.name).toBe("iOS 18");
  });

  it("recovers patch.testCases written in reply with bare keys", () => {
    const patch = parseDefinitionPatch({
      reply:
        'patch.testCases: { modified: [{ id: "TC-001", description: "updated description" }] }',
    });
    expect(patch.testCases?.modified).toEqual([
      { id: "TC-001", description: "updated description" },
    ]);
  });

  it("accepts top-level testCases when patch is missing", () => {
    const patch = parseDefinitionPatch({
      reply: "更新しました",
      testCases: {
        modified: [{ id: "TC-001", description: "from top level" }],
      },
    });
    expect(patch.testCases?.modified?.[0]?.description).toBe("from top level");
  });
});

describe("applyDefinitionPatch", () => {
  it("applies add/remove/modify for test cases and environments", () => {
    const next = applyDefinitionPatch(base, {
      testCases: {
        added: [{ id: "TC-002", category: { major: "B" }, description: "new" }],
        removed: ["TC-001"],
      },
      environments: {
        added: [{ id: "android", name: "Android" }],
        modified: [{ id: "ios", name: "iOS 18" }],
      },
      project: { name: "demo v2" },
    });
    expect(next.project.name).toBe("demo v2");
    expect(next.testCases.map((tc) => tc.id)).toEqual(["TC-002"]);
    expect(next.environments.map((env) => env.id)).toEqual(["web", "ios", "android"]);
    expect(next.environments.find((env) => env.id === "ios")?.name).toBe("iOS 18");
  });

  it("merges partial test case updates", () => {
    const next = applyDefinitionPatch(base, {
      testCases: {
        modified: [{ id: "TC-001", description: "updated description" }],
      },
    });
    expect(next.testCases[0]?.description).toBe("updated description");
    expect(next.testCases[0]?.category.major).toBe("A");
  });

  it("rejects added that reuses an existing test case id", () => {
    expect(() =>
      applyDefinitionPatch(base, {
        testCases: {
          added: [
            {
              id: "TC-001",
              category: { major: "A" },
              description: "duplicate",
            },
          ],
        },
      }),
    ).toThrow("テストケース ID が重複しています: TC-001");
  });

  it("adds and modifies scenarios with valid steps", () => {
    const next = applyDefinitionPatch(base, {
      scenarios: {
        added: [
          {
            id: "smoke",
            name: "スモーク",
            steps: ["TC-001"],
          },
        ],
      },
    });
    expect(next.scenarios).toEqual([
      { id: "smoke", name: "スモーク", steps: ["TC-001"] },
    ]);

    const updated = applyDefinitionPatch(next, {
      testCases: {
        added: [{ id: "TC-002", category: { major: "B" }, description: "second" }],
      },
      scenarios: {
        modified: [{ id: "smoke", steps: ["TC-001", "TC-002"] }],
      },
    });
    expect(updated.scenarios?.[0]?.steps).toEqual(["TC-001", "TC-002"]);
  });

  it("rejects scenario steps that reference unknown test cases", () => {
    expect(() =>
      applyDefinitionPatch(base, {
        scenarios: {
          added: [{ id: "smoke", name: "スモーク", steps: ["TC-999"] }],
        },
      }),
    ).toThrow('scenarios "smoke" に未知の testCase id "TC-999" があります');
  });

  it("scrubs removed test case ids from scenario steps", () => {
    const withScenario = applyDefinitionPatch(base, {
      testCases: {
        added: [{ id: "TC-002", category: { major: "B" }, description: "second" }],
      },
      scenarios: {
        added: [{ id: "smoke", name: "スモーク", steps: ["TC-001", "TC-002"] }],
      },
    });
    const next = applyDefinitionPatch(withScenario, {
      testCases: { removed: ["TC-002"] },
    });
    expect(next.testCases.map((tc) => tc.id)).toEqual(["TC-001"]);
    expect(next.scenarios?.[0]?.steps).toEqual(["TC-001"]);
  });
});

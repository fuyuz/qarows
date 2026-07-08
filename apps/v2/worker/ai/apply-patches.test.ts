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
});

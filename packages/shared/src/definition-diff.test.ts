import { describe, expect, it } from "vitest";
import { computeDefinitionDiff, definitionDiffSummary } from "./definition-diff";
import type { TestDefinition } from "./types";

const baseDefinition = (): TestDefinition => ({
  project: { name: "Demo", id: "demo", version: 1 },
  environments: [{ id: "default", name: "Default" }],
  testCases: [
    {
      id: "TC-001",
      category: { major: "認証" },
      description: "ログインできる",
    },
  ],
});

describe("computeDefinitionDiff", () => {
  it("detects added and modified test cases", () => {
    const before = baseDefinition();
    const after: TestDefinition = {
      ...before,
      testCases: [
        { ...before.testCases[0]!, description: "ログインできる（更新）" },
        {
          id: "TC-002",
          category: { major: "認証" },
          description: "ログアウトできる",
        },
      ],
    };
    const diff = computeDefinitionDiff(before, after);
    expect(diff.testCases.added).toHaveLength(1);
    expect(diff.testCases.modified).toHaveLength(1);
    expect(diff.testCases.modified[0]?.fields[0]?.field).toBe("description");
    expect(definitionDiffSummary(diff)).toContain("+1 TC");
  });

  it("detects removed test cases", () => {
    const before = baseDefinition();
    const after: TestDefinition = { ...before, testCases: [] };
    const diff = computeDefinitionDiff(before, after);
    expect(diff.testCases.removed).toEqual(["TC-001"]);
    expect(diff.hasChanges).toBe(true);
  });
});

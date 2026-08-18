import { describe, expect, it } from "vitest";
import type { TestDefinition } from "@qarows/shared";
import {
  buildEditProposalFromAiResponse,
  buildPatchRepairUserMessage,
  MAX_PATCH_REPAIR_ATTEMPTS,
} from "./propose";

const base: TestDefinition = {
  project: { name: "demo", id: "demo" },
  environments: [{ id: "web", name: "Web" }],
  testCases: [
    {
      id: "TC-001",
      category: { major: "A" },
      description: "existing",
    },
  ],
};

describe("buildEditProposalFromAiResponse", () => {
  it("accepts a valid modified patch", () => {
    const built = buildEditProposalFromAiResponse(
      base,
      {
        reply: "更新しました",
        patch: {
          testCases: {
            modified: [{ id: "TC-001", description: "updated" }],
          },
        },
      },
      "test-model",
    );
    expect(built.ok).toBe(true);
    if (!built.ok) return;
    expect(built.proposal.proposedDefinition.testCases[0]?.description).toBe("updated");
  });

  it("rejects duplicate id in added with a clear error", () => {
    const built = buildEditProposalFromAiResponse(
      base,
      {
        reply: "追加しました",
        patch: {
          testCases: {
            added: [
              {
                id: "TC-001",
                category: { major: "A" },
                description: "dup",
              },
            ],
          },
        },
      },
      "test-model",
    );
    expect(built.ok).toBe(false);
    if (built.ok) return;
    expect(built.error).toContain("テストケース ID が重複しています: TC-001");
  });

  it("rejects empty patch", () => {
    const built = buildEditProposalFromAiResponse(
      base,
      { reply: "特に変更なし", patch: {} },
      "test-model",
    );
    expect(built.ok).toBe(false);
    if (built.ok) return;
    expect(built.error).toContain("編集 patch が空です");
  });

  it("applies patch against working definition and diffs against editor base", () => {
    const working: TestDefinition = {
      ...base,
      testCases: [
        ...base.testCases,
        {
          id: "TC-002",
          category: { major: "A" },
          description: "from prior proposal",
        },
      ],
    };
    const built = buildEditProposalFromAiResponse(
      working,
      {
        reply: "さらに追加しました",
        patch: {
          testCases: {
            added: [
              {
                id: "TC-003",
                category: { major: "A" },
                description: "second edit",
              },
            ],
          },
        },
      },
      "test-model",
      { diffAgainst: base },
    );
    expect(built.ok).toBe(true);
    if (!built.ok) return;
    expect(built.proposal.proposedDefinition.testCases.map((tc) => tc.id)).toEqual([
      "TC-001",
      "TC-002",
      "TC-003",
    ]);
    // Cumulative vs editor base includes both prior proposal TC and this turn's add.
    expect(built.proposal.diff.testCases.added.map((tc) => tc.id).sort()).toEqual([
      "TC-002",
      "TC-003",
    ]);
  });
});

describe("buildPatchRepairUserMessage", () => {
  it("includes the error and repair guidance", () => {
    const message = buildPatchRepairUserMessage("テストケース ID が重複しています: TC-083");
    expect(message).toContain("テストケース ID が重複しています: TC-083");
    expect(message).toContain("added には未使用の新しい ID");
    expect(MAX_PATCH_REPAIR_ATTEMPTS).toBe(3);
  });
});

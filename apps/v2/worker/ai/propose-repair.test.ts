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
});

describe("buildPatchRepairUserMessage", () => {
  it("includes the error and repair guidance", () => {
    const message = buildPatchRepairUserMessage("テストケース ID が重複しています: TC-083");
    expect(message).toContain("テストケース ID が重複しています: TC-083");
    expect(message).toContain("added には未使用の新しい ID");
    expect(MAX_PATCH_REPAIR_ATTEMPTS).toBe(3);
  });
});

import { describe, expect, it } from "vitest";
import {
  AiProposalError,
  assertAiProposalUsable,
  type AiProposalRecord,
} from "./db";

function sampleProposal(overrides: Partial<AiProposalRecord> = {}): AiProposalRecord {
  return {
    id: "prop-1",
    projectId: "proj",
    proposedYaml: "project:\n  name: x\n  id: proj\n",
    baseGeneration: "gen-1",
    instruction: "add a test",
    createdBy: "dev@local",
    createdAt: "2026-07-11T00:00:00.000Z",
    expiresAt: "2026-07-11T00:30:00.000Z",
    consumedAt: null,
    ...overrides,
  };
}

describe("assertAiProposalUsable", () => {
  it("accepts a fresh proposal", () => {
    expect(() =>
      assertAiProposalUsable(sampleProposal(), new Date("2026-07-11T00:10:00.000Z")),
    ).not.toThrow();
  });

  it("rejects consumed proposals", () => {
    expect(() =>
      assertAiProposalUsable(
        sampleProposal({ consumedAt: "2026-07-11T00:05:00.000Z" }),
        new Date("2026-07-11T00:10:00.000Z"),
      ),
    ).toThrow(AiProposalError);
  });

  it("rejects expired proposals", () => {
    expect(() =>
      assertAiProposalUsable(sampleProposal(), new Date("2026-07-11T00:31:00.000Z")),
    ).toThrow(AiProposalError);
  });
});

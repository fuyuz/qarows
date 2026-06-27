import { describe, expect, it } from "vitest";
import { makeDefinition } from "@qarows/shared/test-fixtures";
import { canJumpToRunner, findRunnerIndex } from "@/lib/jump-to-runner";
import type { ResultsFile, SessionConfig } from "@qarows/shared";

const definition = makeDefinition();
const session: SessionConfig = {
  executorName: "qa",
  selectedEnvironmentIds: ["chrome"],
};
const results: ResultsFile = {
  version: 1,
  projectId: "test",
  updatedAt: "2026-01-01T00:00:00.000Z",
  results: {},
  bugs: [],
};

describe("canJumpToRunner", () => {
  it("requires valid session and in-scope test case", () => {
    expect(canJumpToRunner("TC-001", definition, session)).toBe(true);
    expect(canJumpToRunner("TC-001", definition, null)).toBe(false);
    expect(canJumpToRunner("TC-999", definition, session)).toBe(false);
  });
});

describe("findRunnerIndex", () => {
  it("returns index within filtered runner list", () => {
    expect(
      findRunnerIndex("TC-002", definition, session, results, { onlyIncomplete: false }),
    ).toBe(1);
    expect(
      findRunnerIndex("TC-999", definition, session, results, { onlyIncomplete: false }),
    ).toBeNull();
  });
});

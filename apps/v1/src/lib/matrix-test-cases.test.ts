import { describe, expect, it } from "vitest";
import { makeDefinition } from "@qarows/shared/test-fixtures";
import { resolveMatrixTestCases } from "@/lib/matrix-test-cases";
import type { SessionConfig } from "@qarows/shared";

const session: SessionConfig = {
  executorName: "qa",
  selectedEnvironmentIds: ["chrome"],
};

describe("resolveMatrixTestCases", () => {
  const definition = makeDefinition();

  it("uses session scope when session is present", () => {
    const cases = resolveMatrixTestCases(
      definition,
      { onlyIncomplete: false },
      {},
      ["chrome", "firefox", "safari"],
      session,
    );
    expect(cases.map((tc) => tc.id)).toEqual(["TC-001", "TC-002", "TC-003"]);
  });

  it("falls back to all environments when session is null", () => {
    const cases = resolveMatrixTestCases(
      definition,
      { onlyIncomplete: false, majorCategoryFilter: "Billing" },
      {},
      definition.environments.map((env) => env.id),
      null,
    );
    expect(cases.map((tc) => tc.id)).toEqual(["TC-003"]);
  });

  it("applies runner filters without session", () => {
    const cases = resolveMatrixTestCases(
      definition,
      { onlyIncomplete: true },
      {
        "TC-001": { chrome: { status: "OK" } },
      },
      ["chrome"],
      null,
    );
    expect(cases.some((tc) => tc.id === "TC-001")).toBe(false);
    expect(cases.some((tc) => tc.id === "TC-002")).toBe(true);
  });
});

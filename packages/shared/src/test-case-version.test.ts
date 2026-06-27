import { describe, expect, it } from "vitest";
import { isResultEntryValid } from "./test-case-version";
import type { TestCase, TestResultEntry } from "./types";

describe("isResultEntryValid", () => {
  const testCase: TestCase = {
    id: "TC-001",
    version: 2,
    category: { major: "Auth" },
    description: "Login",
  };

  it("accepts matching version", () => {
    const entry: TestResultEntry = { status: "OK", version: 2 };
    expect(isResultEntryValid(entry, testCase)).toBe(true);
  });

  it("rejects stale version", () => {
    const entry: TestResultEntry = { status: "OK", version: 1 };
    expect(isResultEntryValid(entry, testCase)).toBe(false);
  });

  it("treats missing entry version as 1", () => {
    const entry: TestResultEntry = { status: "OK" };
    expect(isResultEntryValid(entry, testCase)).toBe(false);
  });
});

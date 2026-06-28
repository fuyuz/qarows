import { describe, expect, it } from "vitest";
import {
  buildBugPrefillFromTestCase,
  getNextBugStatus,
  isBugClosed,
  nextBugId,
  normalizeBugSeverity,
  normalizeBugStatus,
} from "./bug";
import type { Bug, TestCase } from "./types";

describe("normalizeBugStatus", () => {
  it("maps legacy pending_verification to fixed", () => {
    expect(normalizeBugStatus("pending_verification")).toBe("fixed");
  });

  it("defaults unknown status to open", () => {
    expect(normalizeBugStatus("unknown")).toBe("open");
  });
});

describe("normalizeBugSeverity", () => {
  it("defaults unknown severity to medium", () => {
    expect(normalizeBugSeverity("urgent")).toBe("medium");
  });
});

describe("isBugClosed", () => {
  it("treats resolved and wont_fix as closed", () => {
    expect(isBugClosed("resolved")).toBe(true);
    expect(isBugClosed("wont_fix")).toBe(true);
    expect(isBugClosed("open")).toBe(false);
  });
});

describe("getNextBugStatus", () => {
  it("returns the next status in the main workflow", () => {
    expect(getNextBugStatus("open")).toBe("in_progress");
    expect(getNextBugStatus("in_progress")).toBe("fixed");
    expect(getNextBugStatus("fixed")).toBe("resolved");
  });

  it("returns null at terminal or off-workflow statuses", () => {
    expect(getNextBugStatus("resolved")).toBeNull();
    expect(getNextBugStatus("wont_fix")).toBeNull();
  });
});

describe("buildBugPrefillFromTestCase", () => {
  it("includes prerequisites and description", () => {
    const testCase: TestCase = {
      id: "TC-001",
      category: { major: "Auth" },
      prerequisites: "Logged in",
      description: "Button works",
    };
    const prefill = buildBugPrefillFromTestCase(testCase);
    expect(prefill.steps).toContain("前提: Logged in");
    expect(prefill.steps).toContain("Button works");
    expect(prefill.expected).toBe("Button works");
  });
});

describe("nextBugId", () => {
  it("generates unique BUG-{suffix} ids", () => {
    const existing: Bug[] = [{ id: "BUG-001", title: "A", severity: "medium", status: "open" }];
    const ids = new Set(Array.from({ length: 20 }, () => nextBugId(existing)));
    expect(ids.size).toBe(20);
    for (const id of ids) {
      expect(id).toMatch(/^BUG-[a-z0-9]{6}$/);
    }
  });
});

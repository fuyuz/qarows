import { describe, expect, it } from "vitest";
import {
  computeCategoryProgress,
  computeRunProgress,
  computeRunProgressForTestCases,
  PROGRESS_SEGMENT_ORDER,
  type ProgressBucket,
} from "@/lib/run-progress";
import type { TestDefinition, TestResults } from "@qarows/shared";

const definition: TestDefinition = {
  project: { name: "Test", id: "test" },
  environments: [
    { id: "chrome", name: "Chrome" },
    { id: "firefox", name: "Firefox" },
  ],
  testCases: [
    {
      id: "TC-001",
      category: { major: "Auth" },
      description: "Login",
    },
    {
      id: "TC-002",
      version: 2,
      category: { major: "Auth" },
      description: "Logout",
    },
  ],
};

describe("computeRunProgress", () => {
  it("counts completed and incomplete tests", () => {
    const results: TestResults = {
      "TC-001": {
        chrome: { status: "OK" },
        firefox: { status: "OK" },
      },
    };

    const stats = computeRunProgress(definition, ["chrome", "firefox"], results);
    expect(stats.total).toBe(2);
    expect(stats.completed).toBe(1);
    expect(stats.buckets.incomplete).toBe(1);
    expect(stats.buckets.OK).toBe(1);
  });

  it("ignores stale version results in aggregation", () => {
    const results: TestResults = {
      "TC-002": {
        chrome: { status: "NG", version: 1 },
      },
    };

    const stats = computeRunProgress(definition, ["chrome"], results);
    expect(stats.buckets.incomplete).toBe(2);
    expect(stats.buckets.NG).toBe(0);
  });
});

describe("computeRunProgressForTestCases", () => {
  it("aggregates only provided test cases", () => {
    const results: TestResults = {
      "TC-001": { chrome: { status: "OK" } },
    };

    const stats = computeRunProgressForTestCases(
      [{ id: "TC-001" }],
      definition,
      ["chrome"],
      results,
    );
    expect(stats.total).toBe(1);
    expect(stats.completed).toBe(1);
    expect(stats.buckets.OK).toBe(1);
  });
});

describe("computeCategoryProgress", () => {
  it("groups stats by major category", () => {
    const scopedDefinition: TestDefinition = {
      ...definition,
      testCases: [
        ...definition.testCases,
        {
          id: "TC-003",
          category: { major: "Billing" },
          description: "Invoice",
        },
      ],
    };
    const results: TestResults = {
      "TC-001": { chrome: { status: "OK" } },
    };

    const rows = computeCategoryProgress(scopedDefinition, ["chrome"], results);
    const auth = rows.find((row) => row.major === "Auth");
    expect(auth?.stats.total).toBe(2);
    expect(auth?.stats.completed).toBe(1);
  });
});

describe("PROGRESS_SEGMENT_ORDER", () => {
  it("includes all buckets", () => {
    const buckets: ProgressBucket[] = ["OK", "SKIP", "OK_NG", "NG", "incomplete"];
    expect(PROGRESS_SEGMENT_ORDER).toEqual(buckets);
  });
});

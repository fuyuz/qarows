import { describe, expect, it, vi } from "vitest";
import type { ResultsFile, TestDefinition } from "@qarows/shared";
import { buildProjectRecord } from "@/lib/project-record";

const definition: TestDefinition = {
  project: { name: "Test", id: "test" },
  environments: [{ id: "chrome", name: "Chrome" }],
  testCases: [{ id: "TC-001", category: { major: "Auth" }, description: "Login" }],
};

const results: ResultsFile = {
  version: 1,
  projectId: "test",
  updatedAt: "2026-01-01T00:00:00.000Z",
  results: {},
  bugs: [],
};

describe("buildProjectRecord", () => {
  it("uses explicit updatedAt when provided", () => {
    const record = buildProjectRecord({ definition, results, session: null }, "2026-06-28T12:00:00.000Z");
    expect(record.updatedAt).toBe("2026-06-28T12:00:00.000Z");
  });

  it("defaults updatedAt to now instead of results.updatedAt", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-06-28T15:00:00.000Z"));

    const record = buildProjectRecord({ definition, results, session: null });
    expect(record.updatedAt).toBe("2026-06-28T15:00:00.000Z");

    vi.useRealTimers();
  });
});

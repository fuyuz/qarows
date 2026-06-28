import { describe, expect, it } from "vitest";
import { buildProjectRecord } from "@/lib/project-record";
import { projectRecordToSummary, sortProjectSummaries } from "@/lib/project-summaries";
import type { ProjectSummary } from "@/lib/storage";

describe("sortProjectSummaries", () => {
  it("orders by updatedAt descending", () => {
    const summaries: ProjectSummary[] = [
      { projectId: "old", name: "Old", updatedAt: "2026-01-01T00:00:00.000Z", hasValidSession: false },
      { projectId: "new", name: "New", updatedAt: "2026-06-01T00:00:00.000Z", hasValidSession: true },
    ];
    expect(sortProjectSummaries(summaries).map((entry) => entry.projectId)).toEqual(["new", "old"]);
  });
});

describe("projectRecordToSummary", () => {
  it("reflects session validity", () => {
    const record = buildProjectRecord({
      definition: {
        project: { name: "Demo", id: "demo" },
        environments: [{ id: "chrome", name: "Chrome" }],
        testCases: [],
      },
      results: {
        version: 1,
        projectId: "demo",
        updatedAt: "2026-06-28T12:00:00.000Z",
        results: {},
        bugs: [],
      },
      session: {
        executorName: "qa",
        selectedEnvironmentIds: ["chrome"],
      },
    });

    expect(projectRecordToSummary("demo", record)).toMatchObject({
      projectId: "demo",
      name: "Demo",
      hasValidSession: true,
    });
  });
});

import { describe, expect, it } from "vitest";
import { applyProjectCommand, summaryFromSnapshot, toProjectSnapshot } from "@qarows/application";
import type { ResultsFile, SessionConfig, TestDefinition } from "@qarows/shared";
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
        memos: {},
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

describe("snapshot-derived summary", () => {
  const definition: TestDefinition = {
    project: { name: "Demo", id: "demo" },
    environments: [{ id: "chrome", name: "Chrome" }],
    testCases: [{ id: "TC-001", category: { major: "Auth" }, description: "Login" }],
  };
  const results: ResultsFile = {
    version: 1,
    projectId: "demo",
    updatedAt: "2026-06-28T12:00:00.000Z",
    results: {},
    memos: {},
    bugs: [],
  };

  /**
   * AppContext はコマンドごとの一覧更新を snapshot 由来に切り替えている。
   * IndexedDB のレコード由来と同じサマリになることを固定する
   */
  function expectSummariesAgree(session: SessionConfig | null): void {
    const record = buildProjectRecord({ definition, results, session }, "2026-06-28T12:30:00.000Z");
    const summary = summaryFromSnapshot(toProjectSnapshot("demo", record));

    expect({
      projectId: summary.id,
      name: summary.name,
      updatedAt: summary.updatedAt,
      hasValidSession: summary.hasValidSession ?? false,
    }).toEqual(projectRecordToSummary("demo", record));
  }

  it("matches the record-derived summary with a valid session", () => {
    expectSummariesAgree({ executorName: "qa", selectedEnvironmentIds: ["chrome"] });
  });

  it("matches the record-derived summary without a session", () => {
    expectSummariesAgree(null);
  });

  it("matches the record-derived summary when no environment is selected", () => {
    expectSummariesAgree({ executorName: "qa", selectedEnvironmentIds: [] });
  });

  /**
   * 一覧更新が snapshot 由来になったため、コマンド適用後の snapshot が
   * そのまま永続化されるレコードと一致していないと一覧がずれる
   */
  it("stays in sync after a command renames the project", () => {
    const record = buildProjectRecord(
      { definition, results, session: null },
      "2026-06-28T12:30:00.000Z",
    );
    const renamed: TestDefinition = {
      ...definition,
      project: { ...definition.project, name: "Renamed" },
    };

    const { snapshot } = applyProjectCommand(toProjectSnapshot("demo", record), {
      type: "replaceDefinition",
      definition: renamed,
    });

    const persisted = buildProjectRecord(snapshot, snapshot.updatedAt);
    expect(summaryFromSnapshot(snapshot).name).toBe(
      projectRecordToSummary("demo", persisted).name,
    );
    expect(summaryFromSnapshot(snapshot).name).toBe("Renamed");
  });
});

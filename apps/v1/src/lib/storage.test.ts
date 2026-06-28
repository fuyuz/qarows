import "fake-indexeddb/auto";
import { openDB } from "idb";
import { beforeEach, describe, expect, it } from "vitest";
import type { ResultsFile, TestDefinition } from "@qarows/shared";
import type { ProjectRecord } from "@/lib/storage";
import {
  clearAllProjects,
  deleteProjectFromStorage,
  getAppMeta,
  getProject,
  hasProject,
  listProjectSummaries,
  resetStorageForTests,
  saveAppMeta,
  saveProject,
} from "@/lib/storage";

const DB_NAME = "qarows-v1";

function sampleDefinition(projectId: string, name: string): TestDefinition {
  return {
    project: { name, id: projectId },
    environments: [{ id: "chrome", name: "Chrome" }],
    testCases: [
      {
        id: "TC-001",
        category: { major: "Auth" },
        description: `${name} login`,
      },
    ],
  };
}

function sampleResults(projectId: string, updatedAt: string): ResultsFile {
  return {
    version: 1,
    projectId,
    updatedAt,
    results: {
      "TC-001": {
        chrome: { status: "OK", executedAt: updatedAt, executedBy: "tester" },
      },
    },
    bugs: [{ id: "BUG-001", title: "Crash", severity: "high", status: "open" }],
  };
}

function sampleRecord(projectId: string, name: string, updatedAt: string): ProjectRecord {
  return {
    definition: sampleDefinition(projectId, name),
    results: sampleResults(projectId, updatedAt),
    session: {
      executorName: "Alice",
      selectedEnvironmentIds: ["chrome"],
    },
    updatedAt,
  };
}

describe("storage v2", () => {
  beforeEach(async () => {
    await resetStorageForTests();
  });

  it("saves and retrieves a project record", async () => {
    const record = sampleRecord("app-a", "App A", "2026-06-01T10:00:00Z");
    await saveProject("app-a", record);

    const loaded = await getProject("app-a");
    expect(loaded?.definition.project.name).toBe("App A");
    expect(loaded?.results.results["TC-001"]?.chrome?.status).toBe("OK");
    expect(await hasProject("app-a")).toBe(true);
    expect(await hasProject("missing")).toBe(false);
  });

  it("stores multiple projects independently", async () => {
    await saveProject("app-a", sampleRecord("app-a", "App A", "2026-06-01T10:00:00Z"));
    await saveProject("app-b", sampleRecord("app-b", "App B", "2026-06-02T10:00:00Z"));

    expect(await hasProject("app-a")).toBe(true);
    expect(await hasProject("app-b")).toBe(true);
    expect((await getProject("app-a"))?.definition.project.name).toBe("App A");
    expect((await getProject("app-b"))?.definition.project.name).toBe("App B");
  });

  it("lists summaries sorted by updatedAt descending", async () => {
    await saveProject("older", sampleRecord("older", "Older", "2026-06-01T10:00:00Z"));
    await saveProject("newer", sampleRecord("newer", "Newer", "2026-06-03T10:00:00Z"));

    const summaries = await listProjectSummaries();
    expect(summaries.map((s) => s.projectId)).toEqual(["newer", "older"]);
    expect(summaries[0]?.name).toBe("Newer");
    expect(summaries[0]?.hasValidSession).toBe(true);
  });

  it("reports hasValidSession false when session is null", async () => {
    const record = sampleRecord("app-a", "App A", "2026-06-01T10:00:00Z");
    record.session = null;
    await saveProject("app-a", record);

    const summaries = await listProjectSummaries();
    expect(summaries[0]?.hasValidSession).toBe(false);
  });

  it("deletes a project without affecting others", async () => {
    await saveProject("keep", sampleRecord("keep", "Keep", "2026-06-01T10:00:00Z"));
    await saveProject("drop", sampleRecord("drop", "Drop", "2026-06-02T10:00:00Z"));

    await deleteProjectFromStorage("drop");

    expect(await hasProject("drop")).toBe(false);
    expect(await hasProject("keep")).toBe(true);
    expect((await listProjectSummaries()).map((s) => s.projectId)).toEqual(["keep"]);
  });

  it("persists and reads app meta", async () => {
    await saveAppMeta({ lastOpenedProjectId: "app-a" });
    expect((await getAppMeta()).lastOpenedProjectId).toBe("app-a");
  });

  it("clearAllProjects removes every project and resets meta", async () => {
    await saveProject("app-a", sampleRecord("app-a", "App A", "2026-06-01T10:00:00Z"));
    await saveAppMeta({ lastOpenedProjectId: "app-a" });

    await clearAllProjects();

    expect(await listProjectSummaries()).toEqual([]);
    expect((await getAppMeta()).lastOpenedProjectId).toBeNull();
  });

  it("allows duplicate testCaseId and bug.id across different projects", async () => {
    await saveProject("app-a", sampleRecord("app-a", "App A", "2026-06-01T10:00:00Z"));
    await saveProject("app-b", sampleRecord("app-b", "App B", "2026-06-02T10:00:00Z"));

    const a = await getProject("app-a");
    const b = await getProject("app-b");
    expect(a?.definition.testCases[0]?.id).toBe("TC-001");
    expect(b?.definition.testCases[0]?.id).toBe("TC-001");
    expect(a?.results.bugs[0]?.id).toBe("BUG-001");
    expect(b?.results.bugs[0]?.id).toBe("BUG-001");
    expect(a?.results.projectId).toBe("app-a");
    expect(b?.results.projectId).toBe("app-b");
  });

  it("migrates legacy v1 state blob into projects store", async () => {
    const legacyDb = await openDB(DB_NAME, 1, {
      upgrade(db) {
        db.createObjectStore("meta");
      },
    });
    const definition = sampleDefinition("legacy-app", "Legacy");
    await legacyDb.put(
      "meta",
      {
        definition,
        results: sampleResults("legacy-app", "2026-06-01T08:00:00Z"),
        session: null,
      },
      "state",
    );
    legacyDb.close();

    expect(await hasProject("legacy-app")).toBe(true);
    expect((await getAppMeta()).lastOpenedProjectId).toBe("legacy-app");
    expect((await getProject("legacy-app"))?.definition.project.name).toBe("Legacy");

    const metaDb = await openDB(DB_NAME);
    const metaKeys = await metaDb.getAllKeys("meta");
    metaDb.close();
    expect(metaKeys).not.toContain("state");
  });
});

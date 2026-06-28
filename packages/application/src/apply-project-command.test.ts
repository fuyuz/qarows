import { describe, expect, it } from "vitest";
import { makeDefinition } from "@qarows/shared/test-fixtures";
import { createEmptyResults, type ResultsFile } from "@qarows/shared";
import { applyProjectCommand } from "./apply-project-command";
import type { ProjectSnapshot } from "./types";

const NOW = "2026-06-28T12:00:00.000Z";

function makeSnapshot(overrides: Partial<ProjectSnapshot> = {}): ProjectSnapshot {
  const definition = makeDefinition();
  const id = definition.project.id ?? "test";
  return {
    id,
    name: definition.project.name,
    definition,
    results: createEmptyResults(id),
    session: null,
    updatedAt: NOW,
    ...overrides,
  };
}

describe("applyProjectCommand", () => {
  it("setSession validates and updates session", () => {
    const snapshot = makeSnapshot();
    const { snapshot: next } = applyProjectCommand(
      snapshot,
      {
        type: "setSession",
        session: { executorName: "Alice", selectedEnvironmentIds: ["chrome"] },
      },
      { now: NOW },
    );
    expect(next.session?.executorName).toBe("Alice");
  });

  it("updateResultsBatch stamps executor and version", () => {
    const definition = makeDefinition({
      testCases: [
        {
          id: "TC-001",
          version: 2,
          category: { major: "Auth" },
          description: "Login",
        },
      ],
    });
    const id = definition.project.id ?? "test";
    const snapshot = makeSnapshot({
      definition,
      session: { executorName: "Bob", selectedEnvironmentIds: ["chrome"] },
    });

    const { snapshot: next, affectedTestCaseId } = applyProjectCommand(
      snapshot,
      {
        type: "updateResultsBatch",
        testCaseId: "TC-001",
        envIds: ["chrome", "firefox"],
        partial: { status: "OK" },
      },
      { now: NOW },
    );

    expect(affectedTestCaseId).toBe("TC-001");
    expect(next.results.results["TC-001"]?.chrome).toEqual({
      status: "OK",
      executedAt: NOW,
      executedBy: "Bob",
      version: 2,
    });
    expect(next.results.results["TC-001"]?.firefox?.executedBy).toBe("Bob");
  });

  it("mergeResults applies OK < SKIP < NG", () => {
    const snapshot = makeSnapshot({
      results: {
        version: 1,
        projectId: "test",
        updatedAt: NOW,
        results: {
          "TC-001": {
            chrome: { status: "OK", executedAt: NOW },
          },
        },
        bugs: [],
      },
    });

    const incoming: ResultsFile = {
      version: 1,
      projectId: "test",
      updatedAt: NOW,
      results: {
        "TC-001": {
          chrome: { status: "NG", executedAt: NOW },
        },
      },
      bugs: [],
    };

    const { snapshot: next } = applyProjectCommand(
      snapshot,
      { type: "mergeResults", incoming },
      { now: NOW },
    );

    expect(next.results.results["TC-001"]?.chrome?.status).toBe("NG");
  });

  it("clearResults resets results and session", () => {
    const snapshot = makeSnapshot({
      session: { executorName: "Alice", selectedEnvironmentIds: ["chrome"] },
      results: {
        version: 1,
        projectId: "test",
        updatedAt: NOW,
        results: { "TC-001": { chrome: { status: "OK" } } },
        bugs: [{ id: "B1", title: "x", severity: "low", status: "open" }],
      },
    });

    const { snapshot: next } = applyProjectCommand(snapshot, { type: "clearResults" }, { now: NOW });

    expect(next.session).toBeNull();
    expect(next.results.results).toEqual({});
    expect(next.results.bugs).toEqual([]);
  });

  it("addBug and updateBug modify bugs array", () => {
    const snapshot = makeSnapshot();
    const bug = {
      id: "B1",
      title: "Crash",
      severity: "high" as const,
      status: "open" as const,
    };

    const { snapshot: withBug } = applyProjectCommand(
      snapshot,
      { type: "addBug", bug },
      { now: NOW },
    );
    expect(withBug.results.bugs).toHaveLength(1);

    const { snapshot: updated } = applyProjectCommand(
      withBug,
      { type: "updateBug", bug: { ...bug, status: "fixed", fixNote: "patched" } },
      { now: NOW },
    );
    expect(updated.results.bugs[0]?.status).toBe("fixed");
  });
});

describe("applyProjectCommand parity", () => {
  it("same command sequence yields same snapshot in two passes", () => {
    const base = makeSnapshot({
      session: { executorName: "QA", selectedEnvironmentIds: ["chrome"] },
    });

    const commands = [
      {
        type: "updateResultsBatch" as const,
        testCaseId: "TC-001",
        envIds: ["chrome"],
        partial: { status: "OK" as const },
      },
      {
        type: "updateResultsBatch" as const,
        testCaseId: "TC-002",
        envIds: ["chrome"],
        partial: { status: "NG" as const, memo: "fail" },
      },
    ];

    let a = base;
    let b = base;
    for (const command of commands) {
      a = applyProjectCommand(a, command, { now: NOW }).snapshot;
      b = applyProjectCommand(b, command, { now: NOW }).snapshot;
    }

    expect(a.results).toEqual(b.results);
    expect(a.updatedAt).toBe(b.updatedAt);
  });
});

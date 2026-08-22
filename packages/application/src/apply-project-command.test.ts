import { describe, expect, it } from "vitest";
import { makeDefinition } from "@qarows/shared/test-fixtures";
import { createEmptyResults, type ResultsFile } from "@qarows/shared";
import { applyProjectCommand } from "./apply-project-command";
import type { ProjectCommand } from "./project-command";
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

  it("setSession overwrites executorName when actor is set", () => {
    const snapshot = makeSnapshot();
    const { snapshot: next } = applyProjectCommand(
      snapshot,
      {
        type: "setSession",
        session: { executorName: "fake", selectedEnvironmentIds: ["chrome"] },
      },
      { now: NOW, actor: "qa@example.com" },
    );
    expect(next.session?.executorName).toBe("qa@example.com");
  });

  it("updateResult overwrites executedBy when actor is set", () => {
    const snapshot = makeSnapshot();
    const { snapshot: next } = applyProjectCommand(
      snapshot,
      {
        type: "updateResult",
        testCaseId: "TC-001",
        envId: "chrome",
        entry: { status: "OK", executedBy: "fake" },
      },
      { now: NOW, actor: "qa@example.com" },
    );
    expect(next.results.results["TC-001"]?.chrome?.executedBy).toBe("qa@example.com");
  });

  it("updateResult stamps executedBy from session when entry omits it", () => {
    const snapshot = makeSnapshot({
      session: { executorName: "Alice", selectedEnvironmentIds: ["chrome"] },
    });
    const { snapshot: next } = applyProjectCommand(
      snapshot,
      {
        type: "updateResult",
        testCaseId: "TC-001",
        envId: "chrome",
        entry: { status: "OK" },
      },
      { now: NOW },
    );
    expect(next.results.results["TC-001"]?.chrome?.executedBy).toBe("Alice");
  });

  it("replaceDefinition updates definition and prunes invalid session envs", () => {
    const snapshot = makeSnapshot({
      session: { executorName: "Alice", selectedEnvironmentIds: ["chrome", "missing"] },
    });
    const nextDefinition = {
      ...snapshot.definition,
      testCases: [
        ...snapshot.definition.testCases,
        {
          id: "TC-NEW",
          category: { major: "編集" },
          description: "追加ケース",
        },
      ],
    };
    const { snapshot: next } = applyProjectCommand(
      snapshot,
      { type: "replaceDefinition", definition: nextDefinition },
      { now: NOW },
    );
    expect(next.definition.testCases.some((tc) => tc.id === "TC-NEW")).toBe(true);
    expect(next.session?.selectedEnvironmentIds).toEqual(["chrome"]);
    expect(next.results).toBe(snapshot.results);
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

  it("updateResultsBatch uses actor over session executorName", () => {
    const definition = makeDefinition();
    const snapshot = makeSnapshot({
      definition,
      session: { executorName: "Bob", selectedEnvironmentIds: ["chrome"] },
    });

    const { snapshot: next } = applyProjectCommand(
      snapshot,
      {
        type: "updateResultsBatch",
        testCaseId: "TC-001",
        envIds: ["chrome"],
        partial: { status: "OK" },
      },
      { now: NOW, actor: "qa@example.com" },
    );

    expect(next.results.results["TC-001"]?.chrome?.executedBy).toBe("qa@example.com");
  });

  it("updateTestMemo sets and clears test-level memo", () => {
    const snapshot = makeSnapshot();

    const { snapshot: withMemo, affectedTestCaseId } = applyProjectCommand(
      snapshot,
      { type: "updateTestMemo", testCaseId: "TC-001", memo: " shared note " },
      { now: NOW },
    );
    expect(affectedTestCaseId).toBe("TC-001");
    expect(withMemo.results.memos["TC-001"]).toBe(" shared note ");

    const { snapshot: cleared } = applyProjectCommand(
      withMemo,
      { type: "updateTestMemo", testCaseId: "TC-001", memo: "   " },
      { now: NOW },
    );
    expect(cleared.results.memos["TC-001"]).toBeUndefined();
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
        memos: {},
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
      memos: {},
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
        memos: { "TC-001": "note" },
        bugs: [{ id: "B1", title: "x", severity: "low", status: "open" }],
      },
    });

    const { snapshot: next } = applyProjectCommand(snapshot, { type: "clearResults" }, { now: NOW });

    expect(next.session).toBeNull();
    expect(next.results.results).toEqual({});
    expect(next.results.memos).toEqual({});
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

  it("addBug with existing id upserts instead of duplicating (echo replay)", () => {
    const snapshot = makeSnapshot();
    const bug = {
      id: "B1",
      title: "Crash",
      severity: "high" as const,
      status: "open" as const,
    };

    const { snapshot: once } = applyProjectCommand(snapshot, { type: "addBug", bug }, { now: NOW });
    const { snapshot: twice } = applyProjectCommand(once, { type: "addBug", bug }, { now: NOW });

    expect(twice.results.bugs).toHaveLength(1);
    expect(twice.results.bugs[0]?.id).toBe("B1");
  });

  it("addBug does not overwrite unrelated result entries", () => {
    const snapshot = makeSnapshot({
      session: { executorName: "QA", selectedEnvironmentIds: ["chrome"] },
    });
    const { snapshot: withResult } = applyProjectCommand(
      snapshot,
      {
        type: "updateResultsBatch",
        testCaseId: "TC-001",
        envIds: ["chrome"],
        partial: { status: "OK" },
      },
      { now: NOW },
    );

    const { snapshot: withBug } = applyProjectCommand(
      withResult,
      {
        type: "addBug",
        bug: {
          id: "B1",
          title: "Crash",
          severity: "high",
          status: "open",
        },
      },
      { now: NOW },
    );

    expect(withBug.results.results["TC-001"]?.chrome?.status).toBe("OK");
    expect(withBug.results.bugs).toHaveLength(1);
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
        partial: { status: "NG" as const },
      },
      {
        type: "updateTestMemo" as const,
        testCaseId: "TC-002",
        memo: "fail",
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

describe("definitionChanged", () => {
  /**
   * Team 版はこのフラグだけを見て tests_yaml を書き直すか決める。
   * false のはずのコマンドで true になれば整形が失われ、逆なら定義編集が D1 に届かない
   */
  it("is false for commands that only touch results or session", () => {
    const snapshot = makeSnapshot({
      session: { executorName: "qa", selectedEnvironmentIds: ["chrome"] },
    });

    const cases: ProjectCommand[] = [
      { type: "setSession", session: { executorName: "qa", selectedEnvironmentIds: ["chrome"] } },
      {
        type: "updateResult",
        testCaseId: "TC-001",
        envId: "chrome",
        entry: { status: "OK" },
      },
      {
        type: "updateResultsBatch",
        testCaseId: "TC-001",
        envIds: ["chrome"],
        partial: { status: "OK" },
      },
      { type: "updateTestMemo", testCaseId: "TC-001", memo: "note" },
      { type: "clearTestResult", testCaseId: "TC-001", envId: "chrome" },
      { type: "clearResults" },
      {
        type: "addBug",
        bug: { id: "BUG-1", title: "x", severity: "medium", status: "open" },
      },
      { type: "mergeResults", incoming: createEmptyResults(snapshot.id) },
    ];

    for (const command of cases) {
      const result = applyProjectCommand(snapshot, command, { now: NOW });
      expect(result.definitionChanged, command.type).toBe(false);
      expect(result.snapshot.definition, command.type).toBe(snapshot.definition);
    }
  });

  it("is true for commands that replace the definition", () => {
    const snapshot = makeSnapshot();

    const patched = applyProjectCommand(
      snapshot,
      { type: "updateTestCase", testCaseId: "TC-001", patch: { description: "changed" } },
      { now: NOW },
    );
    expect(patched.definitionChanged).toBe(true);

    const replaced = applyProjectCommand(
      snapshot,
      { type: "replaceDefinition", definition: makeDefinition() },
      { now: NOW },
    );
    expect(replaced.definitionChanged).toBe(true);

    const swapped = applyProjectCommand(
      snapshot,
      {
        type: "replaceSnapshot",
        definition: makeDefinition(),
        results: createEmptyResults(snapshot.id),
        session: null,
      },
      { now: NOW },
    );
    expect(swapped.definitionChanged).toBe(true);
  });
});

describe("replaceSnapshot validation", () => {
  it("rejects a definition carrying a __proto__ test case id", () => {
    const snapshot = makeSnapshot();
    expect(() =>
      applyProjectCommand(snapshot, {
        type: "replaceSnapshot",
        definition: {
          ...snapshot.definition,
          testCases: [{ id: "__proto__", category: { major: "A" }, description: "d" }],
        },
        results: snapshot.results,
        session: null,
      }),
    ).toThrow(/__proto__/);
  });

  it("still accepts a valid replaceSnapshot", () => {
    const snapshot = makeSnapshot();
    const { snapshot: next, definitionChanged } = applyProjectCommand(snapshot, {
      type: "replaceSnapshot",
      definition: makeDefinition(),
      results: snapshot.results,
      session: null,
    });
    expect(definitionChanged).toBe(true);
    expect(next.definition.testCases).toHaveLength(3);
  });
});

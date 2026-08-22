import { describe, expect, it } from "vitest";
import { makeDefinition } from "./test-fixtures";
import { mergeResultsFiles } from "./merge-results";
import { parseResultsJson } from "./parse-results";
import { serializeResultsJson } from "./serialize-results";
import type { Bug, ResultsFile } from "./types";

const definition = makeDefinition();

function resultsWith(bugs: Bug[]): ResultsFile {
  return {
    version: 1,
    projectId: "test",
    updatedAt: "2026-06-28T12:00:00.000Z",
    results: {},
    memos: {},
    bugs,
  };
}

/** Required で受けることで、Bug にフィールドが増えたらこの fixture が compile error になる */
const full: Required<Bug> = {
  id: "BUG-1",
  title: "crash",
  severity: "high",
  status: "open",
  testCaseId: "TC-001",
  environmentIds: ["chrome"],
  assignee: "dev@example.com",
  steps: "1. open",
  expected: "works",
  actual: "crashes",
  fixNote: "patched the parser",
  memo: "seen on staging",
  attachments: [
    {
      key: "0189bd6c-1f2e-4a3b-8c4d-5e6f7a8b9c0d",
      name: "shot.png",
      size: 10,
      mimeType: "image/png",
    },
  ],
};

/** 相手の results.json が任意フィールドを持たない状態（省略して書き出した／古い版） */
const minimal: Bug = { id: "BUG-1", title: "crash", severity: "high", status: "fixed" };

describe("mergeBugs", () => {
  it("keeps fields the incoming file omits", () => {
    const merged = mergeResultsFiles(resultsWith([full]), resultsWith([minimal]));
    expect(merged.bugs).toHaveLength(1);
    expect(merged.bugs[0]).toMatchObject({
      testCaseId: "TC-001",
      environmentIds: ["chrome"],
      assignee: "dev@example.com",
      steps: "1. open",
      expected: "works",
      actual: "crashes",
      fixNote: "patched the parser",
      memo: "seen on staging",
      attachments: full.attachments,
      // 必須フィールドは後勝ち
      status: "fixed",
    });
  });

  it("keeps fields when the omitted keys are explicit undefined from parseResultsJson", () => {
    // parseResultsJson は省略フィールドも undefined として立てるため spread では消える
    const parsed = parseResultsJson(
      JSON.stringify({ projectId: "test", bugs: [minimal] }),
      { definition },
    );
    const merged = mergeResultsFiles(resultsWith([full]), parsed);
    expect(merged.bugs[0]?.memo).toBe("seen on staging");
    expect(merged.bugs[0]?.attachments).toEqual(full.attachments);
    expect(merged.bugs[0]?.testCaseId).toBe("TC-001");
  });

  it("keeps both free-text sides when they differ", () => {
    const other: Bug = { ...minimal, memo: "also on prod", fixNote: "reverted" };
    const merged = mergeResultsFiles(resultsWith([full]), resultsWith([other]));
    expect(merged.bugs[0]?.memo).toBe("seen on staging\n---\nalso on prod");
    expect(merged.bugs[0]?.fixNote).toBe("patched the parser\n---\nreverted");
  });

  it("does not duplicate identical free text", () => {
    const merged = mergeResultsFiles(resultsWith([full]), resultsWith([{ ...minimal, memo: "seen on staging" }]));
    expect(merged.bugs[0]?.memo).toBe("seen on staging");
  });

  it("prefers the incoming value when both sides define a field", () => {
    const other: Bug = { ...minimal, assignee: "qa@example.com", testCaseId: "TC-001" };
    const merged = mergeResultsFiles(resultsWith([full]), resultsWith([other]));
    expect(merged.bugs[0]?.assignee).toBe("qa@example.com");
  });

  it("adds bugs that only exist on one side", () => {
    const extra: Bug = { id: "BUG-2", title: "typo", severity: "low", status: "open" };
    const merged = mergeResultsFiles(resultsWith([full]), resultsWith([extra]));
    expect(merged.bugs.map((bug) => bug.id)).toEqual(["BUG-1", "BUG-2"]);
  });

  it("unions the environments the bug was seen on", () => {
    const a: Bug = { ...minimal, environmentIds: ["chrome"] };
    const b: Bug = { ...minimal, environmentIds: ["firefox"] };
    expect(mergeResultsFiles(resultsWith([a]), resultsWith([b])).bugs[0]?.environmentIds).toEqual([
      "chrome",
      "firefox",
    ]);
  });

  it("does not grow free text when the same file is merged twice", () => {
    // Local 版は保存済み snapshot にマージするので、同じ export を2回取り込みうる
    const other: Bug = { ...minimal, memo: "also on prod", fixNote: "reverted" };
    const once = mergeResultsFiles(resultsWith([full]), resultsWith([other]));
    const twice = mergeResultsFiles(once, resultsWith([other]));
    const thrice = mergeResultsFiles(twice, resultsWith([other]));

    expect(twice.bugs[0]?.memo).toBe(once.bugs[0]?.memo);
    expect(thrice.bugs[0]?.memo).toBe(once.bugs[0]?.memo);
    expect(thrice.bugs[0]?.fixNote).toBe(once.bugs[0]?.fixNote);
  });

  it("is order-insensitive for free text", () => {
    const other: Bug = { ...minimal, memo: "also on prod" };
    const forward = mergeResultsFiles(resultsWith([full]), resultsWith([other]));
    const backward = mergeResultsFiles(resultsWith([other]), resultsWith([full]));
    expect(backward.bugs[0]?.memo?.split("\n---\n").sort()).toEqual(
      forward.bugs[0]?.memo?.split("\n---\n").sort(),
    );
  });

  it("survives a serialize / parse round trip before merging again", () => {
    const merged = mergeResultsFiles(resultsWith([full]), resultsWith([minimal]));
    const reloaded = parseResultsJson(serializeResultsJson(merged), { definition });
    expect(reloaded.bugs[0]).toMatchObject({
      testCaseId: full.testCaseId,
      assignee: full.assignee,
      steps: full.steps,
      memo: full.memo,
      attachments: full.attachments,
    });

    const again = mergeResultsFiles(reloaded, resultsWith([minimal]));
    expect(again.bugs[0]?.attachments).toEqual(full.attachments);
    expect(again.bugs[0]?.memo).toBe(full.memo);
  });
});

import { describe, expect, it } from "vitest";
import {
  isTestComplete,
  isTestGloballyComplete,
  isTestIncomplete,
  resolveIncompleteCheckTargets,
  resolveSessionTestTargets,
  resolveTestTargets,
  testCaseNeedsRetest,
} from "./resolve-test-targets";
import { makeDefinition } from "./test-fixtures";
import type { TestCase, TestDefinition, TestResults } from "./types";

describe("resolveTestTargets", () => {
  it("applies categoryTargets major then medium layers", () => {
    const definition = makeDefinition({
      categoryTargets: [
        {
          match: { major: "Auth" },
          required: "any",
          targets: ["chrome", "firefox"],
        },
        {
          match: { major: "Auth", medium: "Login" },
          required: "all",
          targets: ["chrome"],
        },
      ],
      testCases: [
        {
          id: "TC-001",
          category: { major: "Auth", medium: "Login" },
          description: "Login",
        },
      ],
    });

    const testCase = definition.testCases[0]!;
    expect(resolveTestTargets(testCase, definition)).toEqual({
      environmentIds: ["chrome"],
      required: "all",
    });
  });

  it("intersects with session environments", () => {
    const definition = makeDefinition();
    const testCase = definition.testCases[0]!;
    const targets = resolveSessionTestTargets(testCase, definition, ["chrome"]);
    expect(targets.environmentIds).toEqual(["chrome"]);
    expect(targets.inScope).toBe(true);
  });
});

describe("isTestIncomplete", () => {
  const definition = makeDefinition({
    testCases: [
      {
        id: "TC-001",
        category: { major: "Auth" },
        description: "Any env ok",
        targetEnvironments: { required: "any", targets: ["chrome", "firefox"] },
      },
    ],
  });
  const testCase = definition.testCases[0]!;

  it("any: complete when one environment has valid result", () => {
    const results: TestResults = {
      "TC-001": { chrome: { status: "OK" } },
    };
    expect(isTestIncomplete(testCase, definition, ["chrome", "firefox"], results)).toBe(false);
    expect(isTestComplete(testCase, definition, ["chrome", "firefox"], results)).toBe(true);
  });

  it("any: complete when result exists outside current session", () => {
    const results: TestResults = {
      "TC-001": { firefox: { status: "OK" } },
    };
    expect(isTestIncomplete(testCase, definition, ["chrome"], results)).toBe(false);
    expect(isTestComplete(testCase, definition, ["chrome"], results)).toBe(true);
  });

  it("all: session complete hides from incomplete filter even if other envs are open", () => {
    const allDefinition = makeDefinition({
      testCases: [
        {
          id: "TC-001",
          category: { major: "Auth" },
          description: "All envs",
          targetEnvironments: { required: "all", targets: ["chrome", "firefox"] },
        },
      ],
    });
    const allCase = allDefinition.testCases[0]!;
    const results: TestResults = {
      "TC-001": { chrome: { status: "OK" } },
    };
    expect(isTestIncomplete(allCase, allDefinition, ["chrome"], results)).toBe(false);
    expect(isTestGloballyComplete(allCase, allDefinition, results)).toBe(false);
  });

  it("all: incomplete until every in-scope environment is filled", () => {
    const allCase = makeDefinition().testCases[0]!;
    const partial: TestResults = { "TC-001": { chrome: { status: "OK" } } };
    expect(isTestIncomplete(allCase, makeDefinition(), ["chrome", "firefox"], partial)).toBe(
      true,
    );
  });
});

describe("resolveIncompleteCheckTargets", () => {
  it("any uses project-wide pool", () => {
    const definition = makeDefinition({
      testCases: [
        {
          id: "TC-001",
          category: { major: "Auth" },
          description: "Any env ok",
          targetEnvironments: { required: "any", targets: ["chrome", "firefox"] },
        },
      ],
    });
    const testCase = definition.testCases[0]!;
    expect(resolveIncompleteCheckTargets(testCase, definition, ["chrome"])).toEqual({
      environmentIds: ["chrome", "firefox"],
      required: "any",
      inScope: true,
    });
  });

  it("all uses session intersection", () => {
    const definition = makeDefinition({
      testCases: [
        {
          id: "TC-001",
          category: { major: "Auth" },
          description: "All envs",
          targetEnvironments: { required: "all", targets: ["chrome", "firefox"] },
        },
      ],
    });
    const testCase = definition.testCases[0]!;
    expect(resolveIncompleteCheckTargets(testCase, definition, ["chrome"])).toEqual({
      environmentIds: ["chrome"],
      required: "all",
      inScope: true,
    });
  });
});

describe("testCaseNeedsRetest", () => {
  it("is true when stale version results exist in scope", () => {
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
    const testCase = definition.testCases[0]!;
    const results: TestResults = {
      "TC-001": {
        chrome: { status: "OK", version: 1 },
      },
    };

    expect(testCaseNeedsRetest(testCase, definition, ["chrome"], results)).toBe(true);
    expect(isTestComplete(testCase, definition, ["chrome"], results)).toBe(false);
  });
});

describe("resolveTestTargets caching", () => {
  const testCase: TestCase = {
    id: "TC-001",
    category: { major: "Auth" },
    description: "Login",
  };

  function definitionWith(required: "all" | "any", envIds: string[]): TestDefinition {
    return {
      project: { name: "Test", id: "test" },
      environments: envIds.map((id) => ({ id, name: id })),
      categoryTargets: [{ match: { major: "Auth" }, required }],
      testCases: [testCase],
    };
  }

  it("returns the same result for the same definition and test case", () => {
    const definition = definitionWith("all", ["chrome", "firefox"]);
    const first = resolveTestTargets(testCase, definition);
    expect(resolveTestTargets(testCase, definition)).toBe(first);
  });

  /** definition は差し替えで更新されるので、新しいオブジェクトでは必ず再計算する */
  it("recomputes when the definition object is replaced", () => {
    const before = resolveTestTargets(testCase, definitionWith("all", ["chrome", "firefox"]));
    expect(before.environmentIds).toEqual(["chrome", "firefox"]);
    expect(before.required).toBe("all");

    const after = resolveTestTargets(testCase, definitionWith("any", ["chrome"]));
    expect(after.environmentIds).toEqual(["chrome"]);
    expect(after.required).toBe("any");
  });

  /**
   * キャッシュはオブジェクト同一性で引く。id で引いていると、同じ id の別オブジェクト
   * （draft 編集は spread で新オブジェクトを作る）に古い解決結果を返してしまう
   */
  it("keys on object identity, not on the test case id", () => {
    const definition = definitionWith("all", ["chrome", "firefox"]);
    expect(resolveTestTargets(testCase, definition).environmentIds).toEqual([
      "chrome",
      "firefox",
    ]);

    // 同じ definition・同じ id で、対象環境だけ変えた別オブジェクト
    const scoped: TestCase = {
      ...testCase,
      targetEnvironments: { required: "all", targets: ["firefox"] },
    };
    expect(resolveTestTargets(scoped, definition).environmentIds).toEqual(["firefox"]);
  });

  it("returns a frozen array so a shared result cannot be mutated", () => {
    const resolved = resolveTestTargets(testCase, definitionWith("all", ["chrome", "firefox"]));
    expect(Object.isFrozen(resolved.environmentIds)).toBe(true);
    expect(() => (resolved.environmentIds as string[]).push("ios")).toThrow(TypeError);
  });

  /**
   * major 索引が同一 major の複数エントリを保持していること。
   * major 単位と medium 単位を併記するのが categoryTargets の通常の形なので、
   * 索引が後勝ちで上書きすると major 側の targets が失われる
   */
  it("keeps every categoryTarget that shares a major", () => {
    const definition: TestDefinition = {
      project: { name: "Test", id: "test" },
      environments: [
        { id: "chrome", name: "C" },
        { id: "firefox", name: "F" },
        { id: "ios", name: "I" },
      ],
      categoryTargets: [
        // ios を除く: 既定（全環境）と区別できる major エントリ
        { match: { major: "Auth" }, required: "all", targets: ["chrome", "firefox"] },
        { match: { major: "Auth", medium: "Login" }, required: "any", targets: ["firefox"] },
        { match: { major: "Billing" }, required: "any" },
      ],
      testCases: [],
    };

    const login: TestCase = {
      id: "TC-010",
      category: { major: "Auth", medium: "Login" },
      description: "d",
    };
    expect(resolveTestTargets(login, definition)).toEqual({
      environmentIds: ["firefox"],
      required: "any",
    });

    // major エントリだけが当たるケース。索引が上書きされていると ios が残る
    const other: TestCase = {
      id: "TC-011",
      category: { major: "Auth", medium: "Logout" },
      description: "d",
    };
    expect(resolveTestTargets(other, definition)).toEqual({
      environmentIds: ["chrome", "firefox"],
      required: "all",
    });
  });
});

import { describe, expect, it } from "vitest";
import {
  PROJECT_ID_PATTERN,
  parseTestsYaml,
  resolveProjectId,
  slugifyProjectId,
} from "./parse-tests";

const minimalYaml = (extra = "") => `
project:
  name: Test Project
  id: test-project
environments:
  - id: chrome
    name: Chrome
testCases:
  - id: TC-001
    category:
      major: Auth
    description: Login works
${extra}
`;

describe("resolveProjectId", () => {
  it("uses explicit id when provided", () => {
    expect(resolveProjectId({ id: "my-id" }, "Name")).toBe("my-id");
  });

  it("slugifies ASCII project name when id omitted", () => {
    expect(resolveProjectId({}, "My App QA")).toBe("my-app-qa");
  });

  it("rejects empty explicit id", () => {
    expect(() => resolveProjectId({ id: "  " }, "Name")).toThrow("project.id は空にできません");
  });

  it("requires explicit id for non-ASCII names", () => {
    expect(() => resolveProjectId({}, "日本語のみ")).toThrow("project.id が必要です");
  });
});

describe("parseTestsYaml", () => {
  it("parses valid minimal yaml", () => {
    const def = parseTestsYaml(minimalYaml());
    expect(def.project.id).toBe("test-project");
    expect(def.environments[0]?.id).toBe("chrome");
  });

  it("rejects empty environment id", () => {
    const yaml = `
project:
  name: Test
  id: test
environments:
  - id: ""
    name: Empty
testCases:
  - id: TC-001
    category: { major: A }
    description: x
`;
    expect(() => parseTestsYaml(yaml)).toThrow("environments[0].id は空にできません");
  });

  it("rejects empty targets array", () => {
    const yaml = `
project:
  name: Test
  id: test
environments:
  - id: chrome
testCases:
  - id: TC-001
    category: { major: Auth }
    description: x
    targetEnvironments:
      targets: []
`;
    expect(() => parseTestsYaml(yaml)).toThrow("targets は空配列にできません");
  });

  it("rejects excessive YAML nesting", () => {
    let nested = "x: 1";
    for (let i = 0; i < 40; i++) {
      nested = `wrap:\n  ${nested.replace(/\n/g, "\n  ")}`;
    }
    expect(() => parseTestsYaml(nested)).toThrow(/maxDepth|nesting/i);
  });
});

describe("slugifyProjectId", () => {
  /**
   * 導出 id も PROJECT_ID_PATTERN を満たす必要がある。
   * 満たさない id は URL パス・ストレージキーに使えず、Team 版では API から
   * 一切触れない（削除もできない）プロジェクトが作れてしまう
   */
  it("always produces an id that passes PROJECT_ID_PATTERN", () => {
    for (const name of [
      "qarows",
      "My Project",
      "QA 2026",
      "  padded  ",
      "テスト qarows",
      "スマホアプリ QA",
      "- foo",
      `Web ${"a".repeat(70)}`,
      "a".repeat(64),
      "--",
    ]) {
      const slug = slugifyProjectId(name);
      if (slug) expect(PROJECT_ID_PATTERN.test(slug), `${name} -> ${slug}`).toBe(true);
    }
  });

  it("leaves names that already slugified cleanly untouched", () => {
    expect(slugifyProjectId("qarows")).toBe("qarows");
    expect(slugifyProjectId("My Project")).toBe("my-project");
    expect(slugifyProjectId("QA 2026")).toBe("qa-2026");
  });

  it("strips the leading hyphen a non-ascii prefix used to leave", () => {
    expect(slugifyProjectId("テスト qarows")).toBe("qarows");
    expect(slugifyProjectId("スマホアプリ QA")).toBe("qa");
  });

  it("returns empty when no usable id can be derived", () => {
    expect(slugifyProjectId("日本語のみ")).toBe("");
    expect(slugifyProjectId("--")).toBe("");
  });
});

import { describe, expect, it } from "vitest";
import { parseTestsYaml } from "@qarows/shared";
import { buildEmptyTestsYaml } from "./build-empty-tests";

describe("buildEmptyTestsYaml", () => {
  it("survives names that break hand-written YAML quoting", () => {
    // 末尾バックスラッシュは閉じ引用符を壊し、改行は構造を壊す
    for (const name of [
      "plain",
      'has "quotes"',
      "trailing backslash \\",
      'quote then backslash "\\',
      "with\nnewline",
      "colon: value",
      "#hash",
      "  leading and trailing  ",
      "日本語のプロジェクト名",
      // 数値に見える slug が引用されないと js-yaml が別の値として読み直す
      "1e3",
    ]) {
      const definition = parseTestsYaml(buildEmptyTestsYaml(name));
      expect(definition.project.name, name).toBe(name);
      expect(definition.testCases).toHaveLength(1);
      expect(definition.environments).toHaveLength(1);
    }
  });

  it("derives a slug id and falls back when the name has no ascii", () => {
    expect(parseTestsYaml(buildEmptyTestsYaml("My Project!")).project.id).toBe("my-project");
    expect(parseTestsYaml(buildEmptyTestsYaml("日本語")).project.id).toBe("project");
  });

  it("keeps a numeric-looking slug as written", () => {
    // 引用されていないと js-yaml が 1e3 を 1000 として読み直す
    expect(parseTestsYaml(buildEmptyTestsYaml("1e3")).project.id).toBe("1e3");
    expect(parseTestsYaml(buildEmptyTestsYaml("0o17")).project.id).toBe("0o17");
  });
});

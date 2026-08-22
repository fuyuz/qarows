import { describe, expect, it } from "vitest";
import {
  formatDocumentTitle,
  isProjectWorkspacePath,
  projectIdFromPathname,
  screenLabelFromPathname,
} from "./document-title";

describe("formatDocumentTitle", () => {
  it("joins non-empty segments with pipe", () => {
    expect(
      formatDocumentTitle({
        brand: "qarows",
        screen: "テスト実行",
        projectName: "MyApp",
      }),
    ).toBe("テスト実行 | MyApp | qarows");
  });

  it("omits empty segments", () => {
    expect(formatDocumentTitle({ brand: "qarows" })).toBe("qarows");
    expect(formatDocumentTitle({ brand: "qarows", screen: "プロジェクト一覧" })).toBe(
      "プロジェクト一覧 | qarows",
    );
    expect(formatDocumentTitle({ brand: "qarows", projectName: "  " })).toBe("qarows");
  });
});

describe("screenLabelFromPathname", () => {
  it("resolves known screens", () => {
    expect(screenLabelFromPathname("/projects")).toBe("プロジェクト一覧");
    expect(screenLabelFromPathname("/projects/")).toBe("プロジェクト一覧");
    expect(screenLabelFromPathname("/p/app-a/run")).toBe("テスト実行");
    expect(screenLabelFromPathname("/p/app-a/session")).toBe("セッション設定");
    expect(screenLabelFromPathname("/p/app-a/matrix")).toBe("マトリクス");
    expect(screenLabelFromPathname("/p/app-a/dashboard")).toBe("ダッシュボード");
    expect(screenLabelFromPathname("/p/app-a/bugs")).toBe("バグ");
    expect(screenLabelFromPathname("/p/app-a/tests")).toBe("テスト定義");
  });

  it("decodes encoded page segments", () => {
    expect(screenLabelFromPathname("/p/app-a/%72un")).toBe("テスト実行");
  });

  it("returns null for unknown or non-screen paths", () => {
    expect(screenLabelFromPathname("/")).toBeNull();
    expect(screenLabelFromPathname("/load")).toBeNull();
    expect(screenLabelFromPathname("/p/app-a")).toBeNull();
    expect(screenLabelFromPathname("/p/app-a/unknown")).toBeNull();
  });
});

describe("projectIdFromPathname", () => {
  it("extracts and decodes project ids", () => {
    expect(projectIdFromPathname("/p/app-a/run")).toBe("app-a");
    expect(projectIdFromPathname("/p/app%2Fb/session")).toBe("app/b");
    expect(projectIdFromPathname("/projects")).toBeNull();
  });

  /**
   * runner-ui にあった複製は decodeURIComponent を素で呼んでいて、
   * 不正なエスケープでレンダー中に URIError を投げていた
   */
  it("survives a malformed escape instead of throwing", () => {
    expect(projectIdFromPathname("/p/%zz/run")).toBe("%zz");
    expect(projectIdFromPathname("/p/100%/run")).toBe("100%");
  });
});

describe("isProjectWorkspacePath", () => {
  it("detects project workspace paths", () => {
    expect(isProjectWorkspacePath("/p/app-a/run")).toBe(true);
    expect(isProjectWorkspacePath("/p/app-a")).toBe(true);
    expect(isProjectWorkspacePath("/projects")).toBe(false);
    expect(isProjectWorkspacePath("/")).toBe(false);
  });
});

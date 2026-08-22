import { describe, expect, it } from "vitest";
import { shouldReloadDraft } from "./useDefinitionDraft";

const base = {
  projectChanged: false,
  syncChanged: false,
  definitionChanged: false,
  loaded: true,
  hasChanges: false,
};

describe("shouldReloadDraft", () => {
  it("loads on first render and on project switch", () => {
    expect(shouldReloadDraft({ ...base, loaded: false })).toBe(true);
    expect(shouldReloadDraft({ ...base, projectChanged: true })).toBe(true);
    // 未保存の編集があってもプロジェクトを切り替えたら読み直す
    expect(shouldReloadDraft({ ...base, projectChanged: true, hasChanges: true })).toBe(true);
  });

  it("does nothing while nothing moved", () => {
    expect(shouldReloadDraft(base)).toBe(false);
    expect(shouldReloadDraft({ ...base, hasChanges: true })).toBe(false);
  });

  it("follows a remote change when the editor is clean", () => {
    expect(shouldReloadDraft({ ...base, syncChanged: true })).toBe(true);
    // ランナー側 updateTestCase は generation を動かさないので定義の変化で拾う
    expect(shouldReloadDraft({ ...base, definitionChanged: true })).toBe(true);
  });

  it("keeps unsaved edits when a remote change lands", () => {
    // 捨てずに残し、読み込んだ世代を Apply に送って 409 で気づかせる
    expect(shouldReloadDraft({ ...base, syncChanged: true, hasChanges: true })).toBe(false);
    expect(shouldReloadDraft({ ...base, definitionChanged: true, hasChanges: true })).toBe(false);
  });
});

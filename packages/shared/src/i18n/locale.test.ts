import { afterEach, describe, expect, it, vi } from "vitest";
import { DEFAULT_LOCALE, detectLocale, localeLabel, localeTag, sortLocaleFor } from "./locales";

describe("detectLocale", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("returns default when navigator is unavailable", () => {
    vi.stubGlobal("navigator", undefined);
    expect(detectLocale()).toBe(DEFAULT_LOCALE);
  });

  it("returns ja when browser prefers Japanese", () => {
    vi.stubGlobal("navigator", { language: "ja-JP", languages: ["ja-JP", "en-US"] });
    expect(detectLocale()).toBe("ja");
  });

  it("returns default for unmatched browser languages", () => {
    vi.stubGlobal("navigator", { language: "de-DE", languages: ["de-DE", "en-US"] });
    expect(detectLocale()).toBe(DEFAULT_LOCALE);
  });

  it("returns en when browser prefers English", () => {
    vi.stubGlobal("navigator", { language: "en-US", languages: ["en-US"] });
    expect(detectLocale()).toBe("en");
  });
});

describe("locale registry helpers", () => {
  it("maps locale metadata from registry", () => {
    expect(localeTag("ja")).toBe("ja-JP");
    expect(localeTag("en")).toBe("en-US");
    expect(localeLabel("ja")).toBe("日本語");
    expect(sortLocaleFor("ja")).toBe("ja");
    expect(sortLocaleFor(undefined)).toBe("en");
  });
});

import { afterEach, describe, expect, it, vi } from "vitest";
import { detectLocale } from "./locale";

describe("detectLocale", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("returns en when navigator is unavailable", () => {
    vi.stubGlobal("navigator", undefined);
    expect(detectLocale()).toBe("en");
  });

  it("returns ja when browser prefers Japanese", () => {
    vi.stubGlobal("navigator", { language: "ja-JP", languages: ["ja-JP", "en-US"] });
    expect(detectLocale()).toBe("ja");
  });

  it("returns en for non-Japanese browsers", () => {
    vi.stubGlobal("navigator", { language: "de-DE", languages: ["de-DE", "en-US"] });
    expect(detectLocale()).toBe("en");
  });

  it("returns en when only English is listed", () => {
    vi.stubGlobal("navigator", { language: "en-US", languages: ["en-US"] });
    expect(detectLocale()).toBe("en");
  });
});

import { describe, expect, it } from "vitest";
import { formatAcceptLanguage, parseAcceptLanguage } from "./accept-language";

describe("formatAcceptLanguage", () => {
  it("formats English locale", () => {
    expect(formatAcceptLanguage("en")).toBe("en-US,en;q=0.9");
  });

  it("includes English fallback for Japanese locale", () => {
    expect(formatAcceptLanguage("ja")).toBe("ja-JP,ja;q=0.9,en-US;q=0.8,en;q=0.7");
  });
});

describe("parseAcceptLanguage", () => {
  it("returns default for empty header", () => {
    expect(parseAcceptLanguage(null)).toBe("en");
    expect(parseAcceptLanguage("")).toBe("en");
  });

  it("prefers higher q values", () => {
    expect(parseAcceptLanguage("en-US,ja-JP;q=0.9")).toBe("en");
    expect(parseAcceptLanguage("ja-JP,en-US;q=0.9")).toBe("ja");
  });

  it("round-trips with formatAcceptLanguage", () => {
    expect(parseAcceptLanguage(formatAcceptLanguage("ja"))).toBe("ja");
    expect(parseAcceptLanguage(formatAcceptLanguage("en"))).toBe("en");
  });
});

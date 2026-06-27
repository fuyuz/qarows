import { describe, expect, it } from "vitest";
import { compareStatus, normalizeStatus, strongerStatus } from "./status";

describe("normalizeStatus", () => {
  it("accepts canonical values", () => {
    expect(normalizeStatus("OK")).toBe("OK");
    expect(normalizeStatus("skip")).toBe("SKIP");
    expect(normalizeStatus("OK→NG")).toBe("OK_NG");
    expect(normalizeStatus("OK-NG")).toBe("OK_NG");
  });

  it("rejects unknown values", () => {
    expect(() => normalizeStatus("MAYBE")).toThrow("不明なステータス");
  });
});

describe("strongerStatus", () => {
  it("follows OK < SKIP < OK_NG < NG", () => {
    expect(strongerStatus("OK", "NG")).toBe("NG");
    expect(strongerStatus("SKIP", "OK_NG")).toBe("OK_NG");
    expect(compareStatus("NG", "OK")).toBeGreaterThan(0);
  });

  it("returns either side when equal strength", () => {
    expect(strongerStatus("OK", "OK")).toBe("OK");
  });
});

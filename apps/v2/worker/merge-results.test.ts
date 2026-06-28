import { describe, expect, it } from "vitest";

export function parseMergeResultsBody(raw: unknown): string[] {
  if (typeof raw !== "object" || raw === null) {
    throw new Error("Invalid JSON body");
  }
  const list = (raw as { resultsJsonList?: unknown }).resultsJsonList;
  if (!Array.isArray(list) || list.length === 0) {
    throw new Error("resultsJsonList is required");
  }
  if (!list.every((item) => typeof item === "string")) {
    throw new Error("resultsJsonList must contain strings");
  }
  return list;
}

describe("parseMergeResultsBody", () => {
  it("accepts a non-empty resultsJsonList", () => {
    expect(parseMergeResultsBody({ resultsJsonList: ['{"projectId":"a"}'] })).toEqual([
      '{"projectId":"a"}',
    ]);
  });

  it("rejects empty list", () => {
    expect(() => parseMergeResultsBody({ resultsJsonList: [] })).toThrow(
      "resultsJsonList is required",
    );
  });

  it("rejects missing list", () => {
    expect(() => parseMergeResultsBody({})).toThrow("resultsJsonList is required");
  });
});

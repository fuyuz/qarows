import { describe, expect, it } from "vitest";
import { parseResultsJson } from "./parse-results";

describe("parseResultsJson", () => {
  it("parses valid results", () => {
    const file = parseResultsJson(
      JSON.stringify({
        version: 1,
        projectId: "test",
        updatedAt: "2026-01-01T00:00:00.000Z",
        results: {},
        bugs: [],
      }),
    );
    expect(file.projectId).toBe("test");
    expect(file.version).toBe(1);
  });

  it("rejects invalid root version", () => {
    expect(() =>
      parseResultsJson(JSON.stringify({ version: -1, projectId: "test", results: {}, bugs: [] })),
    ).toThrow("version は 1 以上の整数");
  });

  it("normalizes invalid bug severity to medium", () => {
    const file = parseResultsJson(
      JSON.stringify({
        projectId: "test",
        results: {},
        bugs: [{ id: "BUG-001", title: "Bug", severity: "urgent" }],
      }),
    );
    expect(file.bugs[0]?.severity).toBe("medium");
  });

  it("rejects duplicate bug ids", () => {
    expect(() =>
      parseResultsJson(
        JSON.stringify({
          projectId: "test",
          results: {},
          bugs: [
            { id: "BUG-001", title: "A" },
            { id: "bug-001", title: "B" },
          ],
        }),
      ),
    ).toThrow("重複したバグ ID");
  });
});

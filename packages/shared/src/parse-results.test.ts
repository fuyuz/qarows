import { describe, expect, it } from "vitest";
import { parseResultsJson } from "./parse-results";
import { parseTestsYaml } from "./parse-tests";
import { parseIsoTimestamp } from "./validate-iso-timestamp";

const definitionYaml = `
project:
  name: Test
  id: test-project
environments:
  - id: chrome
    name: Chrome
  - id: firefox
    name: Firefox
testCases:
  - id: TC-001
    category:
      major: Auth
    description: Login works
`;

describe("parseIsoTimestamp", () => {
  it("accepts ISO 8601 strings", () => {
    expect(parseIsoTimestamp("2026-01-01T00:00:00.000Z", "updatedAt")).toBe(
      "2026-01-01T00:00:00.000Z",
    );
  });

  it("rejects invalid timestamps", () => {
    expect(() => parseIsoTimestamp("not-a-date", "updatedAt")).toThrow("ISO 8601");
  });
});

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

  it("rejects invalid updatedAt", () => {
    expect(() =>
      parseResultsJson(
        JSON.stringify({
          projectId: "test",
          updatedAt: "yesterday",
          results: {},
          bugs: [],
        }),
      ),
    ).toThrow("updatedAt は ISO 8601");
  });

  it("rejects invalid executedAt", () => {
    expect(() =>
      parseResultsJson(
        JSON.stringify({
          projectId: "test",
          results: { "TC-001": { chrome: { status: "OK", executedAt: "bad" } } },
          bugs: [],
        }),
      ),
    ).toThrow("executedAt は ISO 8601");
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

  it("validates testCaseId and environmentId when definition is provided", () => {
    const definition = parseTestsYaml(definitionYaml);
    expect(() =>
      parseResultsJson(
        JSON.stringify({
          projectId: "test-project",
          results: { "TC-999": { chrome: { status: "OK" } } },
          bugs: [],
        }),
        { definition },
      ),
    ).toThrow("未定義の testCaseId: TC-999");

    expect(() =>
      parseResultsJson(
        JSON.stringify({
          projectId: "test-project",
          results: { "TC-001": { safari: { status: "OK" } } },
          bugs: [],
        }),
        { definition },
      ),
    ).toThrow("未定義の environmentId: safari");

    expect(() =>
      parseResultsJson(
        JSON.stringify({
          projectId: "wrong-id",
          results: {},
          bugs: [],
        }),
        { definition },
      ),
    ).toThrow("projectId");
  });

  it("validates bug references when definition is provided", () => {
    const definition = parseTestsYaml(definitionYaml);
    expect(() =>
      parseResultsJson(
        JSON.stringify({
          projectId: "test-project",
          results: {},
          bugs: [{ id: "BUG-001", title: "Bug", testCaseId: "TC-999" }],
        }),
        { definition },
      ),
    ).toThrow("未定義の testCaseId: TC-999 (bug: BUG-001)");
  });
});

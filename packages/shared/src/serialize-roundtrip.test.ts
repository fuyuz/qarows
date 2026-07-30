import { describe, expect, it } from "vitest";
import { parseResultsJson } from "./parse-results";
import { parseTestsYaml } from "./parse-tests";
import { serializeResultsJson } from "./serialize-results";
import { serializeTestsYaml } from "./serialize-tests";

const sampleYaml = `
project:
  name: Roundtrip QA
  id: roundtrip
environments:
  - id: chrome
    name: Chrome
categoryTargets:
  - match:
      major: Auth
    required: any
    targets:
      - chrome
testCases:
  - id: TC-001
    version: 2
    category:
      major: Auth
      medium: Login
    prerequisites: Signed out
    description: Login succeeds
    targetEnvironments:
      required: all
      targets:
        - chrome
`;

describe("serialize roundtrip", () => {
  it("preserves tests.yml through parse and serialize", () => {
    const parsed = parseTestsYaml(sampleYaml);
    const reserialized = serializeTestsYaml(parsed);
    const again = parseTestsYaml(reserialized);

    expect(again.project.id).toBe("roundtrip");
    expect(again.testCases[0]?.id).toBe("TC-001");
    expect(again.testCases[0]?.version).toBe(2);
    expect(again.categoryTargets?.[0]?.required).toBe("any");
  });

  it("preserves results.json through parse and serialize", () => {
    const original = {
      version: 1,
      projectId: "roundtrip",
      updatedAt: "2026-06-28T12:00:00.000Z",
      results: {
        "TC-001": {
          chrome: {
            status: "OK",
            version: 2,
            executedAt: "2026-06-28T11:00:00.000Z",
            executedBy: "qa@example.com",
          },
        },
      },
      memos: {
        "TC-001": "fine",
      },
      bugs: [
        {
          id: "BUG-k7m2x9",
          title: "Layout issue",
          severity: "high",
          status: "open",
          testCaseId: "TC-001",
          environmentIds: ["chrome"],
        },
      ],
    };

    const yaml = sampleYaml;
    const definition = parseTestsYaml(yaml);
    const file = parseResultsJson(JSON.stringify(original), { definition });
    const json = serializeResultsJson(file);
    const reparsed = parseResultsJson(json, { definition });

    expect(reparsed.projectId).toBe("roundtrip");
    expect(reparsed.results["TC-001"]?.chrome).toMatchObject({
      status: "OK",
      version: 2,
    });
    expect(reparsed.memos["TC-001"]).toBe("fine");
    expect(reparsed.bugs[0]?.id).toBe("BUG-k7m2x9");
  });

  it("ignores legacy cell memo without error", () => {
    const legacy = {
      version: 1,
      projectId: "roundtrip",
      updatedAt: "2026-06-28T12:00:00.000Z",
      results: {
        "TC-001": {
          chrome: { status: "OK", memo: "legacy cell memo" },
        },
      },
      bugs: [],
    };
    const definition = parseTestsYaml(sampleYaml);
    const file = parseResultsJson(JSON.stringify(legacy), { definition });
    expect(file.results["TC-001"]?.chrome?.status).toBe("OK");
    expect(file.memos).toEqual({});
    expect("memo" in (file.results["TC-001"]?.chrome ?? {})).toBe(false);
  });
});

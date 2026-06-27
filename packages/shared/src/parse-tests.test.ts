import { describe, expect, it } from "vitest";
import { parseTestsYaml, resolveProjectId } from "./parse-tests";

const minimalYaml = (extra = "") => `
project:
  name: Test Project
  id: test-project
environments:
  - id: chrome
    name: Chrome
testCases:
  - id: TC-001
    category:
      major: Auth
    description: Login works
${extra}
`;

describe("resolveProjectId", () => {
  it("uses explicit id when provided", () => {
    expect(resolveProjectId({ id: "my-id" }, "Name")).toBe("my-id");
  });

  it("slugifies ASCII project name when id omitted", () => {
    expect(resolveProjectId({}, "My App QA")).toBe("my-app-qa");
  });

  it("rejects empty explicit id", () => {
    expect(() => resolveProjectId({ id: "  " }, "Name")).toThrow("project.id は空にできません");
  });

  it("requires explicit id for non-ASCII names", () => {
    expect(() => resolveProjectId({}, "日本語のみ")).toThrow("project.id が必要です");
  });
});

describe("parseTestsYaml", () => {
  it("parses valid minimal yaml", () => {
    const def = parseTestsYaml(minimalYaml());
    expect(def.project.id).toBe("test-project");
    expect(def.environments[0]?.id).toBe("chrome");
  });

  it("rejects empty environment id", () => {
    const yaml = `
project:
  name: Test
  id: test
environments:
  - id: ""
    name: Empty
testCases:
  - id: TC-001
    category: { major: A }
    description: x
`;
    expect(() => parseTestsYaml(yaml)).toThrow("environments[0].id は空にできません");
  });

  it("rejects empty targets array", () => {
    const yaml = `
project:
  name: Test
  id: test
environments:
  - id: chrome
testCases:
  - id: TC-001
    category: { major: Auth }
    description: x
    targetEnvironments:
      targets: []
`;
    expect(() => parseTestsYaml(yaml)).toThrow("targets は空配列にできません");
  });
});

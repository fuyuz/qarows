import { describe, expect, it } from "vitest";
import {
  NEW_PROJECT_SELECTION,
  inheritsRunnerQueryFromLocation,
  projectPath,
  projectsHubPath,
  resolveProjectId,
} from "./project-routes";

describe("inheritsRunnerQueryFromLocation", () => {
  it("inherits when location and target project match", () => {
    expect(inheritsRunnerQueryFromLocation("qarows", "qarows")).toBe(true);
  });

  it("does not inherit when switching to another project", () => {
    expect(inheritsRunnerQueryFromLocation("qarows", "alt-app")).toBe(false);
  });

  it("does not inherit from non-project routes", () => {
    expect(inheritsRunnerQueryFromLocation(null, "qarows")).toBe(false);
  });
});

describe("projectPath cross-project safety", () => {
  it("builds run URL without query when test id is omitted", () => {
    expect(projectPath("alt-app", "run")).toBe("/p/alt-app/run");
  });

  it("builds bugs URL with explicit bug id only when provided", () => {
    expect(projectPath("alt-app", "bugs", undefined, null, "BUG-001")).toBe(
      "/p/alt-app/bugs?bug=BUG-001",
    );
  });
});

/**
 * Local / Team はこの 1 実装を共有する。以前は Team が自前のコピーを持ち、
 * resolveProjectId の既定値と projectPath の page 引数が食い違っていた
 */
describe("resolveProjectId", () => {
  const definition = {
    project: { name: "Demo", id: "demo" },
    environments: [],
    testCases: [],
  };

  it("prefers the route id over the loaded definition", () => {
    expect(resolveProjectId(definition, "from-route")).toBe("from-route");
  });

  it("falls back to the definition id, then to a placeholder", () => {
    expect(resolveProjectId(definition)).toBe("demo");
    expect(resolveProjectId(null)).toBe("project");
    expect(resolveProjectId(undefined)).toBe("project");
  });
});

describe("projectsHubPath", () => {
  it("omits the query when nothing is selected", () => {
    expect(projectsHubPath()).toBe("/projects");
    expect(projectsHubPath(null)).toBe("/projects");
  });

  it("encodes the selection", () => {
    expect(projectsHubPath("demo")).toBe("/projects?project=demo");
    expect(projectsHubPath(NEW_PROJECT_SELECTION)).toBe("/projects?project=_new");
    expect(projectsHubPath("a b/c")).toBe("/projects?project=a%20b%2Fc");
  });
});

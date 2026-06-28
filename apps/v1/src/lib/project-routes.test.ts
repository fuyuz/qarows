import { describe, expect, it } from "vitest";
import { inheritsRunnerQueryFromLocation, projectPath } from "@/lib/project-routes";

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

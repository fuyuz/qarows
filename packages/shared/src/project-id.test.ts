import { describe, expect, it } from "vitest";
import { getProjectIdFromDefinition } from "./project-id";
import type { TestDefinition } from "./types";

const base: TestDefinition = {
  project: { name: "Demo" },
  environments: [],
  testCases: [],
};

describe("getProjectIdFromDefinition", () => {
  it("returns project.id when set", () => {
    expect(
      getProjectIdFromDefinition({
        ...base,
        project: { name: "Demo", id: "demo-app" },
      }),
    ).toBe("demo-app");
  });

  it('falls back to "project" when id is omitted', () => {
    expect(getProjectIdFromDefinition(base)).toBe("project");
  });
});

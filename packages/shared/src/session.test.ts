import { describe, expect, it } from "vitest";
import { isValidSession, validateSession } from "./session";

describe("isValidSession", () => {
  it("requires executor name and at least one environment", () => {
    expect(
      isValidSession({ executorName: "qa", selectedEnvironmentIds: ["chrome"] }),
    ).toBe(true);
    expect(isValidSession({ executorName: "  ", selectedEnvironmentIds: ["chrome"] })).toBe(
      false,
    );
    expect(isValidSession({ executorName: "qa", selectedEnvironmentIds: [] })).toBe(false);
  });
});

describe("validateSession", () => {
  it("throws with Japanese messages for invalid input", () => {
    expect(() =>
      validateSession({ executorName: "", selectedEnvironmentIds: ["chrome"] }),
    ).toThrow("実施者名");
    expect(() =>
      validateSession({ executorName: "qa", selectedEnvironmentIds: [] }),
    ).toThrow("端末/環境");
  });
});

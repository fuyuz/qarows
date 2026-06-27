import { describe, expect, it } from "vitest";
import {
  formatRunnerKeys,
  isRunnerNextKey,
  isRunnerPrevKey,
  isRunnerTypingTarget,
  matchRunnerStatusKey,
} from "@/lib/runner-keybindings";

describe("runner keybindings", () => {
  it("maps status keys", () => {
    expect(matchRunnerStatusKey("o")).toBe("OK");
    expect(matchRunnerStatusKey("n")).toBe("NG");
    expect(matchRunnerStatusKey("x")).toBeNull();
  });

  it("detects navigation keys", () => {
    expect(isRunnerPrevKey("h")).toBe(true);
    expect(isRunnerNextKey("ArrowRight")).toBe(true);
    expect(formatRunnerKeys(["ArrowLeft", "h"])).toBe("← / h");
  });

  it("treats form fields as typing targets", () => {
    const textarea = document.createElement("textarea");
    expect(isRunnerTypingTarget(textarea)).toBe(true);
    expect(isRunnerTypingTarget(document.createElement("div"))).toBeFalsy();
    expect(isRunnerTypingTarget(null)).toBe(false);
  });
});

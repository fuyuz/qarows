import { describe, expect, it } from "vitest";
import {
  formatAppNavShortcut,
  isKeyboardTypingTarget,
  matchAppNavigationPage,
} from "./app-keybindings";

describe("app navigation keybindings", () => {
  it("matches Cmd/Ctrl + Shift + letter", () => {
    expect(
      matchAppNavigationPage({
        key: "r",
        metaKey: true,
        ctrlKey: false,
        shiftKey: true,
        altKey: false,
      }),
    ).toBe("run");
    expect(
      matchAppNavigationPage({
        key: "D",
        metaKey: false,
        ctrlKey: true,
        shiftKey: true,
        altKey: false,
      }),
    ).toBe("dashboard");
    expect(
      matchAppNavigationPage({
        key: "m",
        metaKey: true,
        ctrlKey: false,
        shiftKey: false,
        altKey: false,
      }),
    ).toBeNull();
  });

  it("formats shortcut labels", () => {
    expect(formatAppNavShortcut("r")).toMatch(/R$/);
  });

  it("treats form fields as typing targets", () => {
    const input = document.createElement("input");
    expect(isKeyboardTypingTarget(input)).toBe(true);
    expect(isKeyboardTypingTarget(document.createElement("div"))).toBeFalsy();
  });
});

import type { TestStatus } from "@qarows/shared";

/** テストランナーのキーボードショートカット（1キー = 1操作） */
export const RUNNER_KEYBINDINGS = {
  prev: ["ArrowLeft", "h"],
  next: ["ArrowRight", "l"],
  ok: ["o"],
  ng: ["n"],
  skip: ["s"],
  bug: ["b"],
} as const;

const STATUS_BY_KEY: Record<string, TestStatus> = {
  o: "OK",
  n: "NG",
  s: "SKIP",
};

export function isRunnerTypingTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  const tag = target.tagName;
  return tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT" || target.isContentEditable;
}

export function matchRunnerStatusKey(key: string): TestStatus | null {
  return STATUS_BY_KEY[key] ?? null;
}

export function isRunnerPrevKey(key: string): boolean {
  return (RUNNER_KEYBINDINGS.prev as readonly string[]).includes(key);
}

export function isRunnerNextKey(key: string): boolean {
  return (RUNNER_KEYBINDINGS.next as readonly string[]).includes(key);
}

export function isRunnerBugKey(key: string): boolean {
  return (RUNNER_KEYBINDINGS.bug as readonly string[]).includes(key);
}

export function formatRunnerKey(key: string): string {
  if (key === "ArrowLeft") return "←";
  if (key === "ArrowRight") return "→";
  return key;
}

export function formatRunnerKeys(keys: readonly string[]): string {
  return keys.map(formatRunnerKey).join(" / ");
}

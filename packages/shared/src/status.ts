import type { TestStatus } from "./types";

/** OK < SKIP < NG */
export const STATUS_PRIORITY: Record<TestStatus, number> = {
  OK: 1,
  SKIP: 2,
  NG: 3,
};

export const STATUS_LABELS: Record<TestStatus, string> = {
  OK: "OK",
  SKIP: "SKIP",
  NG: "NG",
};

export const ALL_STATUSES: TestStatus[] = ["OK", "SKIP", "NG"];

export function compareStatus(a: TestStatus, b: TestStatus): number {
  return STATUS_PRIORITY[a] - STATUS_PRIORITY[b];
}

export function strongerStatus(a: TestStatus, b: TestStatus): TestStatus {
  return compareStatus(a, b) >= 0 ? a : b;
}

export function normalizeStatus(value: string): TestStatus {
  const normalized = value.trim().toUpperCase().replace(/→/g, "_").replace(/-/g, "_");
  if (normalized === "OK" || normalized === "SKIP" || normalized === "NG") {
    return normalized;
  }
  throw new Error(`不明なステータス: ${value}`);
}

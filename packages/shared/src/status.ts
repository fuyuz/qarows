import type { TestStatus } from "./types";

/** OK < SKIP < OK_NG < NG */
export const STATUS_PRIORITY: Record<TestStatus, number> = {
  OK: 1,
  SKIP: 2,
  OK_NG: 3,
  NG: 4,
};

export const STATUS_LABELS: Record<TestStatus, string> = {
  OK: "OK",
  SKIP: "SKIP",
  OK_NG: "OK→NG",
  NG: "NG",
};

export const ALL_STATUSES: TestStatus[] = ["OK", "SKIP", "OK_NG", "NG"];

export function compareStatus(a: TestStatus, b: TestStatus): number {
  return STATUS_PRIORITY[a] - STATUS_PRIORITY[b];
}

export function strongerStatus(a: TestStatus, b: TestStatus): TestStatus {
  return compareStatus(a, b) >= compareStatus(b, a) ? a : b;
}

export function normalizeStatus(value: string): TestStatus {
  const normalized = value.trim().toUpperCase().replace(/→/g, "_").replace(/-/g, "_");
  if (normalized === "OK_NG" || normalized === "OKNG") return "OK_NG";
  if (normalized === "OK" || normalized === "SKIP" || normalized === "NG") {
    return normalized;
  }
  throw new Error(`不明なステータス: ${value}`);
}

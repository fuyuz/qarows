import type { Bug, BugSeverity, BugStatus, TestCase } from "./types";

export const BUG_STATUS_LABELS: Record<BugStatus, string> = {
  open: "未対応",
  in_progress: "修正中",
  fixed: "修正済み",
  resolved: "修正確認済み",
  wont_fix: "対応しない",
};

export const BUG_SEVERITY_LABELS: Record<BugSeverity, string> = {
  low: "低",
  medium: "中",
  high: "高",
  critical: "致命的",
};

const BUG_STATUSES = new Set<string>(Object.keys(BUG_STATUS_LABELS));

const LEGACY_BUG_STATUS_MAP: Record<string, BugStatus> = {
  pending_verification: "fixed",
};

export function normalizeBugStatus(raw: string): BugStatus {
  const mapped = LEGACY_BUG_STATUS_MAP[raw];
  if (mapped) return mapped;
  return BUG_STATUSES.has(raw) ? (raw as BugStatus) : "open";
}

export function isBugClosed(status: BugStatus): boolean {
  return status === "resolved" || status === "wont_fix";
}

export function buildBugPrefillFromTestCase(testCase: TestCase): {
  steps: string;
  expected: string;
} {
  const parts: string[] = [];
  if (testCase.prerequisites) parts.push(`前提: ${testCase.prerequisites}`);
  parts.push(testCase.description);
  return {
    steps: parts.join("\n\n"),
    expected: testCase.description,
  };
}

export function nextBugId(bugs: Bug[]): string {
  let max = 0;
  for (const bug of bugs) {
    const match = /^BUG-(\d+)$/i.exec(bug.id);
    if (match) max = Math.max(max, Number.parseInt(match[1], 10));
  }
  return `BUG-${String(max + 1).padStart(3, "0")}`;
}

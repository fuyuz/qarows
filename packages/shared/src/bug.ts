import type { Bug, BugSeverity, BugStatus, TestCase } from "./types";

export const BUG_STATUS_LABELS: Record<BugStatus, string> = {
  open: "未対応",
  in_progress: "修正中",
  fixed: "修正済み",
  pending_verification: "修正確認待ち",
  resolved: "解決済み",
};

export const BUG_SEVERITY_LABELS: Record<BugSeverity, string> = {
  low: "低",
  medium: "中",
  high: "高",
  critical: "致命的",
};

const BUG_STATUSES = new Set<string>(Object.keys(BUG_STATUS_LABELS));

export function normalizeBugStatus(raw: string): BugStatus {
  return BUG_STATUSES.has(raw) ? (raw as BugStatus) : "open";
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

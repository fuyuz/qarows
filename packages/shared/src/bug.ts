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

/** メインワークフロー上のステータス順（未対応 → 修正確認済み） */
export const BUG_STATUS_WORKFLOW: BugStatus[] = [
  "open",
  "in_progress",
  "fixed",
  "resolved",
];

/** 進捗バー等の表示順（wont_fix は分岐先として末尾） */
export const BUG_STATUS_DISPLAY_ORDER: BugStatus[] = [...BUG_STATUS_WORKFLOW, "wont_fix"];

const BUG_STATUSES = new Set<string>(Object.keys(BUG_STATUS_LABELS));

const BUG_SEVERITIES = new Set<string>(Object.keys(BUG_SEVERITY_LABELS));

const LEGACY_BUG_STATUS_MAP: Record<string, BugStatus> = {
  pending_verification: "fixed",
};

export function normalizeBugStatus(raw: string): BugStatus {
  const mapped = LEGACY_BUG_STATUS_MAP[raw];
  if (mapped) return mapped;
  return BUG_STATUSES.has(raw) ? (raw as BugStatus) : "open";
}

export function normalizeBugSeverity(raw: string): BugSeverity {
  return BUG_SEVERITIES.has(raw) ? (raw as BugSeverity) : "medium";
}

export function isBugClosed(status: BugStatus): boolean {
  return status === "resolved" || status === "wont_fix";
}

export function getNextBugStatus(current: BugStatus): BugStatus | null {
  const index = BUG_STATUS_WORKFLOW.indexOf(current);
  if (index < 0 || index >= BUG_STATUS_WORKFLOW.length - 1) return null;
  return BUG_STATUS_WORKFLOW[index + 1]!;
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

const BUG_ID_SUFFIX_LENGTH = 6;
const BUG_ID_CHARS = "abcdefghijklmnopqrstuvwxyz0123456789";

function randomBugIdSuffix(): string {
  const bytes = new Uint8Array(BUG_ID_SUFFIX_LENGTH);
  crypto.getRandomValues(bytes);
  let suffix = "";
  for (let i = 0; i < BUG_ID_SUFFIX_LENGTH; i++) {
    suffix += BUG_ID_CHARS[bytes[i]! % BUG_ID_CHARS.length];
  }
  return suffix;
}

/** 並行作業でも衝突しにくい BUG-{6文字} 形式の ID を返す */
export function nextBugId(bugs: Bug[]): string {
  const existing = new Set(bugs.map((bug) => bug.id.toLowerCase()));
  for (let attempt = 0; attempt < 100; attempt++) {
    const id = `BUG-${randomBugIdSuffix()}`;
    if (!existing.has(id.toLowerCase())) return id;
  }
  throw new Error("バグ ID を生成できませんでした");
}

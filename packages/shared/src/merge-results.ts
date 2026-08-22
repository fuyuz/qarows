import { isUnsafeObjectKey } from "./safe-object-key";
import { strongerStatus } from "./status";
import { getResultEntryVersion } from "./test-case-version";
import type { Bug, ResultsFile, TestMemos, TestResultEntry } from "./types";

const MEMO_SEPARATOR = "\n---\n";

/**
 * 区切り済みのセグメント単位で重複を落とす。
 * 全体一致だけを見ていると、同じファイルを 2 回マージするたびに同じメモが積み増しされる
 * （Local 版は保存済み snapshot に対してマージするので現実に起こる）
 */
function mergeMemos(a?: string, b?: string): string | undefined {
  const segments: string[] = [];
  for (const text of [a, b]) {
    for (const segment of (text ?? "").split(MEMO_SEPARATOR)) {
      const trimmed = segment.trim();
      if (trimmed && !segments.includes(trimmed)) segments.push(trimmed);
    }
  }
  return segments.length > 0 ? segments.join(MEMO_SEPARATOR) : undefined;
}

function mergeTestMemos(base: TestMemos, incoming: TestMemos): TestMemos {
  const out: TestMemos = { ...base };
  for (const [testCaseId, memo] of Object.entries(incoming)) {
    if (isUnsafeObjectKey(testCaseId)) continue;
    const merged = mergeMemos(out[testCaseId], memo);
    if (merged) out[testCaseId] = merged;
    else delete out[testCaseId];
  }
  return out;
}

function mergeEntry(a: TestResultEntry, b: TestResultEntry): TestResultEntry {
  const versionA = getResultEntryVersion(a);
  const versionB = getResultEntryVersion(b);

  if (versionA !== versionB) {
    const prefer = versionA > versionB ? a : b;
    const other = versionA > versionB ? b : a;
    const preferVersion = getResultEntryVersion(prefer);
    return {
      status: prefer.status,
      ...(preferVersion > 1 ? { version: preferVersion } : {}),
      executedAt: prefer.executedAt ?? other.executedAt,
      executedBy: prefer.executedBy ?? other.executedBy,
    };
  }

  const status = strongerStatus(a.status, b.status);
  const prefer =
    status === a.status && status !== b.status
      ? a
      : status === b.status && status !== a.status
        ? b
        : (a.executedAt ?? "") >= (b.executedAt ?? "")
          ? a
          : b;

  return {
    status,
    version: prefer.version ?? a.version ?? b.version,
    executedAt: prefer.executedAt ?? a.executedAt ?? b.executedAt,
    executedBy: prefer.executedBy ?? a.executedBy ?? b.executedBy,
  };
}

/** バグが再現した環境は片方を捨てず束ねる（別端末で踏んだ報告が消えないように） */
function mergeEnvironmentIds(a?: string[], b?: string[]): string[] | undefined {
  if (!a) return b;
  if (!b) return a;
  const merged = [...new Set([...a, ...b])];
  return merged.length > 0 ? merged : undefined;
}

/**
 * 任意フィールドが増えたときに取りこぼしを型で検出するための写像。
 * homomorphic でない mapped type なので optional が外れ、キーの追加忘れが compile error になる
 */
type AllFields<T> = { [K in keyof Required<T>]: T[K] };

/**
 * 同 id のバグをフィールド単位でマージする。
 * spread では潰れる: parseResultsJson は省略された任意フィールドも undefined として
 * 明示的に立てるため、`{ ...existing, ...bug }` だと片方に無いだけで既存値が消える。
 * 自由記入テキストは Local 版のメモ規則どおり両方残し、それ以外は値があるほうを採る。
 * Bug に時刻がないため、必須フィールド（title / severity / status）は後勝ちのまま
 */
function mergeBug(existing: Bug, incoming: Bug): Bug {
  const merged: AllFields<Bug> = {
    id: incoming.id,
    title: incoming.title,
    severity: incoming.severity,
    status: incoming.status,
    testCaseId: incoming.testCaseId ?? existing.testCaseId,
    environmentIds: mergeEnvironmentIds(existing.environmentIds, incoming.environmentIds),
    assignee: incoming.assignee ?? existing.assignee,
    steps: incoming.steps ?? existing.steps,
    expected: incoming.expected ?? existing.expected,
    actual: incoming.actual ?? existing.actual,
    fixNote: mergeMemos(existing.fixNote, incoming.fixNote),
    memo: mergeMemos(existing.memo, incoming.memo),
    // 添付は束ねない: parse 時に MAX_BUG_ATTACHMENTS で切られる一方、マージ結果は
    // 再正規化されないため、union すると上限超えのバグを作れてしまう
    attachments: incoming.attachments ?? existing.attachments,
  };
  return merged;
}

function mergeBugs(base: Bug[], incoming: Bug[]): Bug[] {
  const map = new Map<string, Bug>();
  for (const bug of base) map.set(bug.id, bug);
  for (const bug of incoming) {
    const existing = map.get(bug.id);
    map.set(bug.id, existing ? mergeBug(existing, bug) : bug);
  }
  return [...map.values()];
}

export function mergeResultsFiles(base: ResultsFile, incoming: ResultsFile): ResultsFile {
  if (base.projectId !== incoming.projectId) {
    throw new Error(
      `projectId が一致しません: ${base.projectId} と ${incoming.projectId}`,
    );
  }

  const results = structuredClone(base.results);

  for (const [testCaseId, envMap] of Object.entries(incoming.results)) {
    // hasOwnProperty で見る: `__proto__` だと `results[testCaseId]` が継承アクセサを
    // 読んで truthy になり、代入が Object.prototype 自体に飛ぶ。
    // 入口（parseResultsJson / parseTestsYaml）で弾いているが、ここは影響が
    // プロセス全体に及ぶので単体でも安全にしておく
    if (isUnsafeObjectKey(testCaseId)) continue;
    if (!Object.prototype.hasOwnProperty.call(results, testCaseId)) {
      results[testCaseId] = {};
    }
    const target = results[testCaseId]!;
    for (const [envId, entry] of Object.entries(envMap)) {
      if (isUnsafeObjectKey(envId)) continue;
      const existing = target[envId];
      target[envId] = existing ? mergeEntry(existing, entry) : entry;
    }
  }

  return {
    version: Math.max(base.version, incoming.version),
    projectId: base.projectId,
    updatedAt: new Date().toISOString(),
    results,
    memos: mergeTestMemos(base.memos ?? {}, incoming.memos ?? {}),
    bugs: mergeBugs(base.bugs, incoming.bugs),
  };
}

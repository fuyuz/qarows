/** Fallback per-isolate limit for AI propose (used only when AI_RATE_LIMIT is unbound). */
export const AI_PROPOSE_WINDOW_MS = 60_000;
export const AI_PROPOSE_MAX_PER_WINDOW = 20;

interface Bucket {
  count: number;
  resetAt: number;
}

const buckets = new Map<string, Bucket>();

export class AiRateLimitError extends Error {
  readonly status = 429;

  constructor(message = "AI リクエストが多すぎます。しばらく待ってから再試行してください") {
    super(message);
    this.name = "AiRateLimitError";
  }
}

export function normalizeAiRateLimitKey(key: string): string {
  return key.trim().toLowerCase() || "anonymous";
}

/**
 * Increment and enforce a sliding fixed window per key.
 * module スコープの Map なので isolate 単位でしか効かない。Cloudflare は isolate を
 * 多数立てるため実効上限は不定で、AI_RATE_LIMIT が設定されていないときの下限として残す
 */
export function assertAiProposeRateLimit(key: string, now = Date.now()): void {
  const normalized = normalizeAiRateLimitKey(key);
  let bucket = buckets.get(normalized);
  if (!bucket || now >= bucket.resetAt) {
    bucket = { count: 0, resetAt: now + AI_PROPOSE_WINDOW_MS };
    buckets.set(normalized, bucket);
  }
  bucket.count += 1;
  if (bucket.count > AI_PROPOSE_MAX_PER_WINDOW) {
    throw new AiRateLimitError();
  }
}

/**
 * Rate Limiting binding があればそれを使う。isolate ではなく Cloudflare のロケーション
 * 単位で数えるため実効上限が定まる（ただしロケーション単位なのでグローバルではない）。
 * 未設定のデプロイでは従来の isolate ローカル制限にフォールバックする
 */
export async function assertAiProposeAllowed(
  limiter: RateLimit | undefined,
  key: string,
): Promise<void> {
  if (!limiter) {
    assertAiProposeRateLimit(key);
    return;
  }
  const { success } = await limiter.limit({ key: normalizeAiRateLimitKey(key) });
  if (!success) throw new AiRateLimitError();
}

/** Test helper — clear in-memory buckets. */
export function resetAiProposeRateLimitsForTests(): void {
  buckets.clear();
}

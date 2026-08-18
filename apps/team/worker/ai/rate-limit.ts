/** Best-effort per-isolate rate limit for AI propose (Dashboard rules still recommended). */
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

/** Increment and enforce a sliding fixed window per key (typically user email). */
export function assertAiProposeRateLimit(key: string, now = Date.now()): void {
  const normalized = key.trim().toLowerCase() || "anonymous";
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

/** Test helper — clear in-memory buckets. */
export function resetAiProposeRateLimitsForTests(): void {
  buckets.clear();
}

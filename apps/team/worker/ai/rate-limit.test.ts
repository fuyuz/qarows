import { beforeEach, describe, expect, it } from "vitest";
import {
  AI_PROPOSE_MAX_PER_WINDOW,
  AiRateLimitError,
  assertAiProposeAllowed,
  assertAiProposeRateLimit,
  normalizeAiRateLimitKey,
  resetAiProposeRateLimitsForTests,
} from "./rate-limit";

function limiterAllowing(allowed: number): { limiter: RateLimit; keys: string[] } {
  const keys: string[] = [];
  let seen = 0;
  return {
    keys,
    limiter: {
      async limit({ key }: { key?: string }) {
        keys.push(key ?? "");
        seen += 1;
        return { success: seen <= allowed };
      },
    } as unknown as RateLimit,
  };
}

describe("assertAiProposeAllowed", () => {
  beforeEach(() => {
    resetAiProposeRateLimitsForTests();
  });

  it("uses the binding when one is configured", async () => {
    const { limiter, keys } = limiterAllowing(1);
    await expect(assertAiProposeAllowed(limiter, "QA@Example.com ")).resolves.toBeUndefined();
    await expect(assertAiProposeAllowed(limiter, "QA@Example.com ")).rejects.toThrow(
      AiRateLimitError,
    );
    // key は正規化して渡す（大文字・空白で別枠にならないように）
    expect(keys).toEqual(["qa@example.com", "qa@example.com"]);
  });

  it("does not consume the isolate fallback while the binding is in use", async () => {
    const { limiter } = limiterAllowing(1000);
    for (let index = 0; index <= AI_PROPOSE_MAX_PER_WINDOW; index += 1) {
      await assertAiProposeAllowed(limiter, "qa@example.com");
    }
    // フォールバック側のカウンタは進んでいない
    expect(() => assertAiProposeRateLimit("qa@example.com")).not.toThrow();
  });

  it("falls back to the per-isolate limit when unbound", async () => {
    for (let index = 0; index < AI_PROPOSE_MAX_PER_WINDOW; index += 1) {
      await assertAiProposeAllowed(undefined, "qa@example.com");
    }
    await expect(assertAiProposeAllowed(undefined, "qa@example.com")).rejects.toThrow(
      AiRateLimitError,
    );
    // 別ユーザーは影響を受けない
    await expect(assertAiProposeAllowed(undefined, "dev@example.com")).resolves.toBeUndefined();
  });
});

describe("normalizeAiRateLimitKey", () => {
  it("collapses case and whitespace, and names the empty key", () => {
    expect(normalizeAiRateLimitKey(" QA@Example.com ")).toBe("qa@example.com");
    expect(normalizeAiRateLimitKey("   ")).toBe("anonymous");
  });
});

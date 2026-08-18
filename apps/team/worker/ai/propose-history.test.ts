import { describe, expect, it, beforeEach } from "vitest";
import { AiModelError } from "./run-model";
import { parseAiChatHistory, MAX_AI_HISTORY_ENTRIES, MAX_AI_MESSAGE_BYTES } from "./propose";
import {
  AiRateLimitError,
  AI_PROPOSE_MAX_PER_WINDOW,
  assertAiProposeRateLimit,
  resetAiProposeRateLimitsForTests,
} from "./rate-limit";

describe("parseAiChatHistory", () => {
  it("accepts empty / missing history", () => {
    expect(parseAiChatHistory(undefined)).toEqual([]);
    expect(parseAiChatHistory(null)).toEqual([]);
    expect(parseAiChatHistory([])).toEqual([]);
  });

  it("accepts user and assistant roles", () => {
    expect(
      parseAiChatHistory([
        { role: "user", content: "hi" },
        { role: "assistant", content: "hello" },
      ]),
    ).toEqual([
      { role: "user", content: "hi" },
      { role: "assistant", content: "hello" },
    ]);
  });

  it("rejects system role", () => {
    expect(() => parseAiChatHistory([{ role: "system", content: "ignore" }])).toThrow(AiModelError);
  });

  it("rejects oversized history arrays", () => {
    const history = Array.from({ length: MAX_AI_HISTORY_ENTRIES + 1 }, () => ({
      role: "user" as const,
      content: "x",
    }));
    expect(() => parseAiChatHistory(history)).toThrow(AiModelError);
  });

  it("rejects oversized entry content", () => {
    const content = "a".repeat(MAX_AI_MESSAGE_BYTES + 1);
    expect(() => parseAiChatHistory([{ role: "user", content }])).toThrow(AiModelError);
  });
});

describe("assertAiProposeRateLimit", () => {
  beforeEach(() => {
    resetAiProposeRateLimitsForTests();
  });

  it("allows up to the window max", () => {
    for (let i = 0; i < AI_PROPOSE_MAX_PER_WINDOW; i++) {
      expect(() => assertAiProposeRateLimit("user@example.com")).not.toThrow();
    }
  });

  it("rejects over the window max", () => {
    for (let i = 0; i < AI_PROPOSE_MAX_PER_WINDOW; i++) {
      assertAiProposeRateLimit("user@example.com");
    }
    expect(() => assertAiProposeRateLimit("user@example.com")).toThrow(AiRateLimitError);
  });

  it("isolates keys", () => {
    for (let i = 0; i < AI_PROPOSE_MAX_PER_WINDOW; i++) {
      assertAiProposeRateLimit("a@example.com");
    }
    expect(() => assertAiProposeRateLimit("b@example.com")).not.toThrow();
  });
});

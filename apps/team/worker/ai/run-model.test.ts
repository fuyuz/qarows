import { describe, expect, it } from "vitest";
import { extractAiResponseText, parseAiJsonResponse } from "./run-model";
import { DEFAULT_AI_MODEL, DEFAULT_AI_MODEL_FALLBACK, supportsJsonSchemaResponse } from "./models";

describe("AI model defaults", () => {
  it("uses json_schema-capable models", () => {
    expect(DEFAULT_AI_MODEL).toBe("@cf/meta/llama-3.3-70b-instruct-fp8-fast");
    expect(DEFAULT_AI_MODEL_FALLBACK).toBe("@cf/meta/llama-3.1-8b-instruct-fast");
  });
});

describe("supportsJsonSchemaResponse", () => {
  it("allows configured json_schema models", () => {
    expect(supportsJsonSchemaResponse("@cf/meta/llama-3.3-70b-instruct-fp8-fast")).toBe(true);
    expect(supportsJsonSchemaResponse("@cf/meta/llama-3.1-8b-instruct-fast")).toBe(true);
    expect(supportsJsonSchemaResponse("@cf/meta/llama-3.2-1b-instruct")).toBe(false);
    expect(supportsJsonSchemaResponse("@cf/zai-org/glm-4.7-flash")).toBe(false);
  });
});

describe("extractAiResponseText", () => {
  it("reads legacy string response field", () => {
    expect(extractAiResponseText({ response: '{"reply":"ok"}' })).toBe('{"reply":"ok"}');
  });

  it("reads json_schema object response field", () => {
    expect(
      extractAiResponseText({
        response: { reply: "ok", patch: { testCases: { removed: ["TC-1"] } } },
      }),
    ).toBe('{"reply":"ok","patch":{"testCases":{"removed":["TC-1"]}}}');
  });

  it("throws on empty response", () => {
    expect(() => extractAiResponseText({})).toThrow("Empty AI response");
  });
});

describe("parseAiJsonResponse", () => {
  it("reads object response directly", () => {
    expect(
      parseAiJsonResponse({
        response: {
          reply: "回答です",
          patch: { testCases: { added: [{ id: "TC-1", category: { major: "A" }, description: "d" }] } },
        },
      }),
    ).toEqual({
      reply: "回答です",
      patch: { testCases: { added: [{ id: "TC-1", category: { major: "A" }, description: "d" }] } },
    });
  });

  it("parses fenced JSON string", () => {
    expect(
      parseAiJsonResponse({
        response: '```json\n{"reply":"ok","patch":{"testCases":{"removed":["TC-1"]}}}\n```',
      }),
    ).toEqual({ reply: "ok", patch: { testCases: { removed: ["TC-1"] } } });
  });

  it("extracts JSON object from surrounding text", () => {
    expect(
      parseAiJsonResponse({
        response: 'Here is JSON:\n{"reply":"ok","patch":{}}\nThanks',
      }),
    ).toEqual({ reply: "ok", patch: {} });
  });

  it("throws on invalid JSON", () => {
    expect(() => parseAiJsonResponse({ response: '{"reply":' })).toThrow("not valid JSON");
  });
});

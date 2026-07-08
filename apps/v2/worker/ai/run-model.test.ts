import { describe, expect, it } from "vitest";
import { extractAiResponseText } from "./run-model";
import { DEFAULT_AI_MODEL, DEFAULT_AI_MODEL_FALLBACK, supportsJsonSchemaResponse } from "./models";

describe("AI model defaults", () => {
  it("uses json_schema-capable models", () => {
    expect(DEFAULT_AI_MODEL).toBe("@cf/meta/llama-3.1-8b-instruct-fast");
    expect(DEFAULT_AI_MODEL_FALLBACK).toBe("@cf/meta/llama-3.2-3b-instruct");
  });
});

describe("supportsJsonSchemaResponse", () => {
  it("allows configured json_schema models", () => {
    expect(supportsJsonSchemaResponse("@cf/meta/llama-3.1-8b-instruct-fast")).toBe(true);
    expect(supportsJsonSchemaResponse("@cf/meta/llama-3.2-1b-instruct")).toBe(false);
    expect(supportsJsonSchemaResponse("@cf/zai-org/glm-4.7-flash")).toBe(false);
  });
});

describe("extractAiResponseText", () => {
  it("reads legacy string response field", () => {
    expect(extractAiResponseText({ response: '{"reply":"ok","testsYaml":null}' })).toBe(
      '{"reply":"ok","testsYaml":null}',
    );
  });

  it("reads json_schema object response field", () => {
    expect(
      extractAiResponseText({
        response: { reply: "ok", testsYaml: null },
      }),
    ).toBe('{"reply":"ok","testsYaml":null}');
  });

  it("throws on empty response", () => {
    expect(() => extractAiResponseText({})).toThrow("Empty AI response");
  });
});

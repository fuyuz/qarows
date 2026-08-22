import { describe, expect, it } from "vitest";
import { AiModelError, extractAiResponseText, parseAiJsonResponse, runAiModel } from "./run-model";
import {
  DEFAULT_AI_MODEL,
  DEFAULT_AI_MODEL_FALLBACK,
  JSON_SCHEMA_AI_MODELS,
  supportsJsonSchemaResponse,
} from "./models";

describe("AI model defaults", () => {
  it("uses json_schema-capable models", () => {
    expect(DEFAULT_AI_MODEL).toBe("@cf/openai/gpt-oss-120b");
    expect(DEFAULT_AI_MODEL_FALLBACK).toBe("@cf/meta/llama-3.3-70b-instruct-fp8-fast");
  });
});

describe("supportsJsonSchemaResponse", () => {
  it("allows configured json_schema models", () => {
    expect(supportsJsonSchemaResponse("@cf/openai/gpt-oss-120b")).toBe(true);
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

  it("bounds how much of the response reaches the log", () => {
    // 応答にはプロジェクトの YAML が入るので、丸ごとはログに出さない。
    // 切り分けに要るのは長さと JSON.parse のメッセージ、そして末尾
    const logged: string[] = [];
    const original = console.error;
    console.error = (...args: unknown[]) => {
      logged.push(args.map(String).join(" "));
    };
    const body = "a".repeat(120) + "社外秘プロジェクト" + "b".repeat(2000);
    const raw = `{"reply": "${body}`;
    try {
      expect(() => parseAiJsonResponse({ response: raw } as never)).toThrow();
    } finally {
      console.error = original;
    }

    expect(logged).toHaveLength(1);
    expect(logged[0]!.length).toBeLessThan(300);
    expect(logged[0]).not.toContain("社外秘");
    expect(logged[0]).toContain(`${raw.length} chars`);
    expect(logged[0]).toContain("parse=");
  });
});

describe("runAiModel", () => {
  // json_schema 対応モデルでないと buildModelPayload が先に落ちる
  const PRIMARY = JSON_SCHEMA_AI_MODELS[0]!;
  const FALLBACK = JSON_SCHEMA_AI_MODELS[1]!;

  function envWith(responses: Array<string | Error>) {
    const calls: string[] = [];
    return {
      calls,
      env: {
        AI_MODEL: PRIMARY,
        AI_MODEL_FALLBACK: FALLBACK,
        AI: {
          async run(model: string) {
            calls.push(model);
            const next = responses.shift();
            if (next instanceof Error) throw next;
            return { response: next };
          },
        },
      } as never,
    };
  }

  const input = {
    messages: [{ role: "user" as const, content: "hi" }],
    jsonSchema: {
      type: "object",
      properties: { reply: { type: "string" } },
      required: ["reply"],
    },
  } as never;

  it("returns the parsed response alongside the raw result", async () => {
    const { env, calls } = envWith([JSON.stringify({ reply: "ok", patch: { a: 1 } })]);
    const run = await runAiModel(env, input);

    expect(calls).toEqual([PRIMARY]);
    expect(run.modelUsed).toBe(PRIMARY);
    expect(run.parsed.reply).toBe("ok");
    // 呼び出し側が再パースしないため、result と parsed が必ず対応していること
    expect(run.parsed).toEqual(parseAiJsonResponse(run.result));
  });

  it("returns the fallback model's parsed response, not the primary's", async () => {
    const { env, calls } = envWith([
      "{not json",
      JSON.stringify({ reply: "from fallback" }),
    ]);
    const run = await runAiModel(env, input);

    expect(calls).toEqual([PRIMARY, FALLBACK]);
    expect(run.modelUsed).toBe(FALLBACK);
    expect(run.parsed.reply).toBe("from fallback");
    expect(run.parsed).toEqual(parseAiJsonResponse(run.result));
  });

  it("throws when every model fails", async () => {
    const { env, calls } = envWith(["{not json", "{still not json"]);
    await expect(runAiModel(env, input)).rejects.toThrow(AiModelError);
    expect(calls).toEqual([PRIMARY, FALLBACK]);
  });
});

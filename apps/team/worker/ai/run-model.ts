import type { Env } from "../env";
import { resolveAiModelConfig, supportsJsonSchemaResponse } from "./models";

export class AiModelError extends Error {
  constructor(
    message: string,
    readonly cause?: unknown,
  ) {
    super(message);
    this.name = "AiModelError";
  }
}

export interface AiChatMessage {
  role: "system" | "user" | "assistant";
  content: string;
}

interface AiJsonSchema {
  type: "object";
  properties: Record<string, unknown>;
  required: string[];
}

export interface AiRunInput {
  messages: AiChatMessage[];
  temperature?: number;
  maxTokens?: number;
  jsonSchema: AiJsonSchema;
}

type AiRunResult = Record<string, unknown>;

function isRetryableAiError(err: unknown): boolean {
  const message = err instanceof Error ? err.message : String(err);
  const lower = message.toLowerCase();
  return (
    message.includes("5025") ||
    message.includes("7502") ||
    message.includes("7505") ||
    message.includes("7506") ||
    message.includes("JSON Mode couldn't be met") ||
    message.includes("doesn't support JSON Schema") ||
    message.includes("not valid JSON") ||
    message.includes("model not found") ||
    lower.includes("deprecated") ||
    lower.includes("rate limit") ||
    lower.includes("empty ai response") ||
    lower.includes("ai reply is empty") ||
    lower.includes("internal server error") ||
    lower.includes("timeout") ||
    lower.includes("context length")
  );
}

function buildModelPayload(model: string, input: AiRunInput): Record<string, unknown> {
  if (!supportsJsonSchemaResponse(model)) {
    throw new AiModelError(`Model does not support json_schema: ${model}`);
  }

  return {
    messages: input.messages,
    temperature: input.temperature ?? 0.2,
    max_tokens: input.maxTokens ?? 4096,
    stream: false,
    response_format: {
      type: "json_schema",
      json_schema: input.jsonSchema,
    },
  };
}

function responsePayloadToText(value: unknown): string | null {
  if (typeof value === "string" && value.trim()) {
    return value.trim();
  }
  if (value && typeof value === "object") {
    return JSON.stringify(value);
  }
  return null;
}

export interface AiJsonResponse {
  reply?: string;
  patch?: unknown;
}

function extractJsonCandidate(raw: string): string {
  const trimmed = raw.trim();
  const fenced = trimmed.match(/```(?:json)?\s*([\s\S]*?)\s*```/i);
  const inner = fenced?.[1]?.trim() ?? trimmed;
  const start = inner.indexOf("{");
  const end = inner.lastIndexOf("}");
  if (start >= 0 && end > start) return inner.slice(start, end + 1);
  return inner;
}

export function parseAiJsonResponse(result: AiRunResult): AiJsonResponse {
  const response = result.response;
  if (response && typeof response === "object" && !Array.isArray(response)) {
    const obj = response as Record<string, unknown>;
    if (typeof obj.reply === "string") {
      return {
        reply: obj.reply,
        patch: obj.patch,
      };
    }
  }

  const raw = extractAiResponseText(result);
  try {
    return JSON.parse(extractJsonCandidate(raw)) as AiJsonResponse;
  } catch (err) {
    console.error("[ai] invalid JSON response snippet:", raw.slice(0, 500));
    throw new AiModelError(
      "AI response was not valid JSON (応答が長すぎて途切れた可能性があります)",
      err,
    );
  }
}

export function extractAiResponseText(result: AiRunResult): string {
  const fromResponse = responsePayloadToText(result.response);
  if (fromResponse) return fromResponse;

  const choices = result.choices;
  if (Array.isArray(choices)) {
    for (const choice of choices) {
      if (!choice || typeof choice !== "object") continue;
      const message = (choice as { message?: { content?: unknown } }).message;
      const fromChoice = responsePayloadToText(message?.content);
      if (fromChoice) return fromChoice;
    }
  }

  throw new AiModelError("Empty AI response");
}

function toAiModelError(err: unknown, fallbackMessage: string): AiModelError {
  if (err instanceof AiModelError) return err;
  if (err instanceof TypeError) {
    return new AiModelError(`AI response parse error: ${err.message}`, err);
  }
  const message = err instanceof Error ? err.message : fallbackMessage;
  return new AiModelError(message, err);
}

export async function runAiModel(
  env: Env,
  input: AiRunInput,
): Promise<{ result: AiRunResult; modelUsed: string; parsed: AiJsonResponse }> {
  if (!env.AI) {
    throw new AiModelError("AI binding is not configured");
  }

  const { primary, fallback } = resolveAiModelConfig(env);
  const models = fallback && fallback !== primary ? [primary, fallback] : [primary];
  let lastError: unknown;

  for (let index = 0; index < models.length; index += 1) {
    const model = models[index]!;
    const isLast = index === models.length - 1;
    try {
      const payload = buildModelPayload(model, input);
      const result = (await env.AI.run(model, payload)) as AiRunResult;
      // 検証結果をそのまま返す（呼び出し側で再パースすると大きな YAML を2回読む）
      return { result, modelUsed: model, parsed: parseAiJsonResponse(result) };
    } catch (err) {
      lastError = err;
      console.error(`[ai] model failed: ${model}`, err);
      if (!isLast && isRetryableAiError(err)) {
        continue;
      }
      throw toAiModelError(err, "AI inference failed");
    }
  }

  throw toAiModelError(lastError, "AI inference failed");
}

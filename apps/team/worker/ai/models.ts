/** Workers AI JSON Mode (json_schema) 対応モデル。
 * @see https://developers.cloudflare.com/workers-ai/features/json-mode/
 * gpt-oss-120b は上記リスト未掲載だが、response_format: json_schema が
 * スキーマ強制込みで動作することを実機確認済み（2026-08）。
 */
export const JSON_SCHEMA_AI_MODELS = [
  "@cf/openai/gpt-oss-120b",
  "@cf/meta/llama-3.3-70b-instruct-fp8-fast",
  "@cf/meta/llama-3.1-8b-instruct-fast",
  "@cf/meta/llama-3.2-11b-vision-instruct",
  "@cf/deepseek-ai/deepseek-r1-distill-qwen-32b",
] as const;

export const DEFAULT_AI_MODEL = JSON_SCHEMA_AI_MODELS[0];
export const DEFAULT_AI_MODEL_FALLBACK = JSON_SCHEMA_AI_MODELS[1];

export interface AiModelConfig {
  primary: string;
  fallback: string | null;
}

export function resolveAiModelConfig(env: {
  AI_MODEL?: string;
  AI_MODEL_FALLBACK?: string;
}): AiModelConfig {
  const primary = env.AI_MODEL?.trim() || DEFAULT_AI_MODEL;
  const fallbackRaw = env.AI_MODEL_FALLBACK?.trim();
  const fallback = fallbackRaw || DEFAULT_AI_MODEL_FALLBACK;
  return { primary, fallback };
}

export function supportsJsonSchemaResponse(model: string): boolean {
  return (JSON_SCHEMA_AI_MODELS as readonly string[]).includes(model);
}

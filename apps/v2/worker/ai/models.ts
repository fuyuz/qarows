/** Workers AI JSON Mode (json_schema) 対応モデル。 */
export const JSON_SCHEMA_AI_MODELS = [
  "@cf/meta/llama-3.1-8b-instruct-fast",
  "@cf/meta/llama-3.2-3b-instruct",
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

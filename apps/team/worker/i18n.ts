import {
  createTranslator,
  parseAcceptLanguage,
  type Locale,
  type TranslationParams,
  type TranslateFn,
} from "@qarows/shared";
import { HTTPException } from "hono/http-exception";
import type { ContentfulStatusCode } from "hono/utils/http-status";
import type { Context } from "hono";
import { GenerationMismatchError, MergeResultsValidationError } from "./merge-results";
import type { AppEnv } from "./types";

const MERGE_VALIDATION_KEY_BY_MESSAGE: Record<string, string> = {
  "Invalid JSON body": "api.invalidJsonBody",
  "resultsJsonList is required": "api.resultsJsonListRequired",
  "resultsJsonList must be an array": "api.resultsJsonListMustBeArray",
  "resultsJsonList must contain strings": "api.resultsJsonListMustContainStrings",
  "expectedGeneration is required": "api.expectedGenerationRequired",
};

export function resolveRequestLocale(c: Context<AppEnv>): Locale {
  return c.get("locale");
}

export function requestT(
  c: Context<AppEnv>,
  key: string,
  params?: TranslationParams,
): string {
  return c.get("t")(key, params);
}

export function apiError(
  c: Context<AppEnv>,
  status: ContentfulStatusCode,
  key: string,
  params?: TranslationParams,
): never {
  throw new HTTPException(status, { message: requestT(c, key, params) });
}

export function mapMergeValidationError(c: Context<AppEnv>, err: unknown): never {
  if (err instanceof MergeResultsValidationError) {
    const key = MERGE_VALIDATION_KEY_BY_MESSAGE[err.message];
    if (key) {
      apiError(c, 400, key);
    }
    apiError(c, 400, "api.invalidResultsJson", { detail: err.message });
  }
  throw err;
}

export function mapGenerationConflict(c: Context<AppEnv>, err: unknown): never {
  if (err instanceof GenerationMismatchError) {
    apiError(c, 409, "api.generationMismatch");
  }
  throw err;
}

export function createRequestI18n(header: string | null | undefined) {
  const locale = parseAcceptLanguage(header);
  const t = createTranslator(locale);
  return { locale, t };
}

export type { TranslateFn };

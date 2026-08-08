import type { Locale, TranslationParams } from "./types";
import { DEFAULT_LOCALE, messageCatalogs } from "./locales";

export type Messages = Record<string, unknown>;

function lookup(messages: Messages, key: string): string | undefined {
  const parts = key.split(".");
  let value: unknown = messages;
  for (const part of parts) {
    if (value == null || typeof value !== "object" || !(part in value)) {
      return undefined;
    }
    value = (value as Record<string, unknown>)[part];
  }
  return typeof value === "string" ? value : undefined;
}

function interpolate(template: string, params?: TranslationParams): string {
  if (!params) return template;
  let result = template;
  for (const [name, value] of Object.entries(params)) {
    result = result.replaceAll(`{${name}}`, String(value));
  }
  return result;
}

export type TranslateFn = (key: string, params?: TranslationParams) => string;

export function createTranslator(locale: Locale, catalogs: Record<Locale, Messages> = messageCatalogs): TranslateFn {
  const fallback = catalogs[DEFAULT_LOCALE];
  const messages = catalogs[locale] ?? fallback;
  return (key, params) => {
    const template = lookup(messages, key) ?? lookup(fallback, key) ?? key;
    return interpolate(template, params);
  };
}

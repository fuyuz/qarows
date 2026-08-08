export const LOCALES = ["ja", "en"] as const;
export type Locale = (typeof LOCALES)[number];

export const DEFAULT_LOCALE: Locale = "en";

export type TranslationParams = Record<string, string | number>;

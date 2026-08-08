export type { Locale, LocaleDefinition } from "./locales";
export {
  DEFAULT_LOCALE,
  LOCALES,
  LOCALE_DEFINITIONS,
  detectLocale,
  getLocaleDefinition,
  localeLabel,
  localeTag,
  messageCatalogs,
  sortLocaleFor,
} from "./locales";

export type TranslationParams = Record<string, string | number>;

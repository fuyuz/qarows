import type { BugSeverity, BugStatus } from "../types";
import type { LocaleDefinition } from "./locales";
import type { Locale, TranslationParams } from "./types";
import { createTranslator, type TranslateFn } from "./translate";
import {
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

export type { Locale, LocaleDefinition, TranslationParams, TranslateFn };
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
};
export { createTranslator } from "./translate";
export { jaMessages, enMessages } from "./messages";
export {
  formatAcceptLanguage,
  parseAcceptLanguage,
} from "./accept-language";
export {
  getAcceptLanguageHeader,
  getClientI18n,
  getClientLocale,
  initClientLocale,
  setClientLocale,
} from "./client-locale";

export function createI18n(locale: Locale) {
  const t = createTranslator(locale);
  return { locale, t, localeTag: localeTag(locale) };
}

export function bugStatusLabel(status: BugStatus, t: TranslateFn): string {
  return t(`bug.status.${status}`);
}

export function bugSeverityLabel(severity: BugSeverity, t: TranslateFn): string {
  return t(`bug.severity.${severity}`);
}

export function bugStatusLabels(t: TranslateFn): Record<BugStatus, string> {
  return {
    open: bugStatusLabel("open", t),
    in_progress: bugStatusLabel("in_progress", t),
    fixed: bugStatusLabel("fixed", t),
    resolved: bugStatusLabel("resolved", t),
    wont_fix: bugStatusLabel("wont_fix", t),
  };
}

export function bugSeverityLabels(t: TranslateFn): Record<BugSeverity, string> {
  return {
    low: bugSeverityLabel("low", t),
    medium: bugSeverityLabel("medium", t),
    high: bugSeverityLabel("high", t),
    critical: bugSeverityLabel("critical", t),
  };
}

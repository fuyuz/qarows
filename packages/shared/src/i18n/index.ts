import type { BugSeverity, BugStatus } from "../types";
import type { Locale, TranslationParams } from "./types";
import { createTranslator, localeTag, type TranslateFn } from "./translate";
import { messageCatalogs } from "./messages";

export type { Locale, TranslationParams, TranslateFn };
export { LOCALES, DEFAULT_LOCALE } from "./types";
export { createTranslator, localeTag } from "./translate";
export { detectLocale } from "./locale";
export { messageCatalogs, jaMessages, enMessages } from "./messages";

export function createI18n(locale: Locale) {
  const t = createTranslator(locale, messageCatalogs);
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

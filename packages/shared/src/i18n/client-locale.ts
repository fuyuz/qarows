import { formatAcceptLanguage, parseAcceptLanguage } from "./accept-language";
import { detectLocale, localeTag, type Locale } from "./locales";
import { createTranslator } from "./translate";

let clientLocale: Locale | null = null;

/** ブラウザ起動時の推定。手動切替前の初期値 */
export function initClientLocale(): Locale {
  if (clientLocale == null) {
    clientLocale = detectLocale();
  }
  return clientLocale;
}

/** I18nProvider から呼び、UI と非 React コードのロケールを同期 */
export function setClientLocale(locale: Locale): void {
  clientLocale = locale;
}

export function getClientLocale(): Locale {
  return clientLocale ?? initClientLocale();
}

export function getClientI18n() {
  const locale = getClientLocale();
  const t = createTranslator(locale);
  return { locale, t, localeTag: localeTag(locale) };
}

/** API / WebSocket 用 Accept-Language ヘッダー値 */
export function getAcceptLanguageHeader(): string {
  return formatAcceptLanguage(getClientLocale());
}

export { formatAcceptLanguage, parseAcceptLanguage };

import { DEFAULT_LOCALE, type Locale } from "./types";

/** ブラウザの言語設定からロケールを推定。日本語以外は英語（デフォルト）。 */
export function detectLocale(): Locale {
  if (typeof navigator === "undefined") return DEFAULT_LOCALE;

  const languages =
    navigator.languages?.length > 0 ? navigator.languages : [navigator.language];

  for (const lang of languages) {
    if (!lang) continue;
    if (lang.toLowerCase().startsWith("ja")) return "ja";
  }

  return DEFAULT_LOCALE;
}

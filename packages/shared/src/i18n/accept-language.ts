import {
  DEFAULT_LOCALE,
  LOCALE_DEFINITIONS,
  localeTag,
  type Locale,
} from "./locales";

/** UI ロケールから RFC 7231 形式の Accept-Language ヘッダー値を生成 */
export function formatAcceptLanguage(locale: Locale): string {
  const primary = localeTag(locale);
  const primaryBase = primary.split("-")[0]!;
  const fallback = localeTag(DEFAULT_LOCALE);
  const fallbackBase = fallback.split("-")[0]!;

  if (locale === DEFAULT_LOCALE) {
    return `${primary},${primaryBase};q=0.9`;
  }

  return `${primary},${primaryBase};q=0.9,${fallback};q=0.8,${fallbackBase};q=0.7`;
}

function matchLanguageTag(tag: string): Locale | null {
  const normalized = tag.toLowerCase();
  for (const def of LOCALE_DEFINITIONS) {
    if (def.bcp47.toLowerCase() === normalized) return def.id;
    if (def.browserPrefixes.some((prefix) => normalized.startsWith(prefix))) {
      return def.id;
    }
  }
  return null;
}

/** Accept-Language ヘッダー（または同等の文字列）から最適なロケールを選ぶ */
export function parseAcceptLanguage(header: string | null | undefined): Locale {
  if (!header?.trim()) return DEFAULT_LOCALE;

  const preferences = header
    .split(",")
    .map((part) => {
      const [tagPart, ...params] = part.trim().split(";");
      const tag = tagPart?.trim() ?? "";
      const qParam = params.find((p) => p.trim().startsWith("q="));
      const q = qParam ? Number.parseFloat(qParam.split("=")[1] ?? "1") : 1;
      return { tag, q: Number.isFinite(q) ? q : 0 };
    })
    .filter((entry) => entry.tag.length > 0)
    .sort((a, b) => b.q - a.q);

  for (const { tag } of preferences) {
    const matched = matchLanguageTag(tag);
    if (matched) return matched;
  }

  return DEFAULT_LOCALE;
}

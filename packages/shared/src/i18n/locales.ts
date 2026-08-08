/**
 * 言語追加はこのファイルだけ編集すれば OK（翻訳ファイル messages/xx.ts の追加を除く）。
 *
 * 1. messages/xx.ts を en.ts からコピーして翻訳
 * 2. 下の LOCALE_DEFINITIONS にエントリを追加
 */
import { enMessages } from "./messages/en";
import { jaMessages } from "./messages/ja";

export interface LocaleDefinition {
  /** アプリ内ロケール ID（messages/xx.ts の xx と一致） */
  readonly id: string;
  /** 言語切替 UI に表示する名前（各言語のネイティブ表記） */
  readonly label: string;
  /** Intl / toLocaleString 用 BCP 47 タグ */
  readonly bcp47: string;
  /** localeCompare 用ロケール */
  readonly sortLocale: string;
  /** navigator.language がこのいずれかで始まればマッチ（小文字） */
  readonly browserPrefixes: readonly string[];
  readonly messages: Record<string, unknown>;
}

export const LOCALE_DEFINITIONS = [
  {
    id: "ja",
    label: "日本語",
    bcp47: "ja-JP",
    sortLocale: "ja",
    browserPrefixes: ["ja"],
    messages: jaMessages,
  },
  {
    id: "en",
    label: "English",
    bcp47: "en-US",
    sortLocale: "en",
    browserPrefixes: ["en"],
    messages: enMessages,
  },
] as const satisfies readonly LocaleDefinition[];

export type Locale = (typeof LOCALE_DEFINITIONS)[number]["id"];

export const LOCALES: readonly Locale[] = LOCALE_DEFINITIONS.map((def) => def.id);

/** ブラウザ未対応時・未マッチ時のフォールバック */
export const DEFAULT_LOCALE = "en" as const satisfies Locale;

const localeById = new Map<Locale, (typeof LOCALE_DEFINITIONS)[number]>(
  LOCALE_DEFINITIONS.map((def) => [def.id, def]),
);

export function getLocaleDefinition(locale: Locale): (typeof LOCALE_DEFINITIONS)[number] {
  const def = localeById.get(locale);
  if (!def) throw new Error(`Unknown locale: ${locale}`);
  return def;
}

export const messageCatalogs = LOCALE_DEFINITIONS.reduce(
  (acc, def) => {
    acc[def.id] = def.messages;
    return acc;
  },
  {} as Record<Locale, Record<string, unknown>>,
);

export function localeTag(locale: Locale): string {
  return getLocaleDefinition(locale).bcp47;
}

export function sortLocaleFor(locale?: Locale | string): string {
  if (locale && localeById.has(locale as Locale)) {
    return getLocaleDefinition(locale as Locale).sortLocale;
  }
  return getLocaleDefinition(DEFAULT_LOCALE).sortLocale;
}

export function localeLabel(locale: Locale): string {
  return getLocaleDefinition(locale).label;
}

function matchBrowserLanguage(lang: string): Locale | null {
  const normalized = lang.toLowerCase();
  for (const def of LOCALE_DEFINITIONS) {
    if (def.browserPrefixes.some((prefix) => normalized.startsWith(prefix))) {
      return def.id;
    }
  }
  return null;
}

/** ブラウザの言語設定からロケールを推定。未マッチ時は DEFAULT_LOCALE。 */
export function detectLocale(): Locale {
  if (typeof navigator === "undefined") return DEFAULT_LOCALE;

  const languages =
    navigator.languages?.length > 0 ? navigator.languages : [navigator.language];

  for (const lang of languages) {
    if (!lang) continue;
    const matched = matchBrowserLanguage(lang);
    if (matched) return matched;
  }

  return DEFAULT_LOCALE;
}

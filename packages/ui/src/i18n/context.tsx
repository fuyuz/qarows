import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import {
  createI18n,
  detectLocale,
  type Locale,
  type TranslateFn,
} from "@qarows/shared";

interface I18nContextValue {
  locale: Locale;
  localeTag: string;
  t: TranslateFn;
  setLocale: (locale: Locale) => void;
}

const I18nContext = createContext<I18nContextValue | null>(null);

export interface I18nProviderProps {
  children: ReactNode;
  initialLocale?: Locale;
}

export function I18nProvider({ children, initialLocale }: I18nProviderProps) {
  const [locale, setLocaleState] = useState<Locale>(initialLocale ?? detectLocale);

  const setLocale = useCallback((next: Locale) => {
    setLocaleState(next);
  }, []);

  const value = useMemo(() => {
    const i18n = createI18n(locale);
    return { ...i18n, setLocale };
  }, [locale, setLocale]);

  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}

export function useI18n(): I18nContextValue {
  const ctx = useContext(I18nContext);
  if (!ctx) throw new Error("useI18n must be used within I18nProvider");
  return ctx;
}

export function useTranslation() {
  const { t, locale, localeTag, setLocale } = useI18n();
  return { t, locale, localeTag, setLocale };
}

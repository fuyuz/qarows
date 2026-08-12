import { Check } from "lucide-react";
import { LOCALES, localeLabel } from "@qarows/shared";
import { useTranslation } from "./context";
import {
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
} from "../components/ui/dropdown-menu";

export interface LanguageMenuSectionProps {
  /** メニューを閉じるなど、ロケール選択後のコールバック */
  onLocaleChange?: () => void;
}

export function LanguageMenuSection({ onLocaleChange }: LanguageMenuSectionProps) {
  const { t, locale, setLocale } = useTranslation();

  return (
    <>
      <DropdownMenuSeparator />
      <DropdownMenuLabel className="text-xs uppercase tracking-wide text-muted-foreground">
        {t("nav.language")}
      </DropdownMenuLabel>
      {LOCALES.map((code) => (
        <DropdownMenuItem
          key={code}
          onSelect={(event) => {
            event.preventDefault();
            if (code !== locale) setLocale(code);
            onLocaleChange?.();
          }}
        >
          <span className="flex-1">{localeLabel(code)}</span>
          {code === locale ? <Check className="size-4 text-muted-foreground" aria-hidden /> : null}
        </DropdownMenuItem>
      ))}
    </>
  );
}

import { Languages } from "lucide-react";
import { LOCALES, localeLabel } from "@qarows/shared";
import { useTranslation } from "./context";
import { Button } from "../components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "../components/ui/dropdown-menu";

export interface LanguageSwitcherProps {
  variant?: "icon" | "text";
  className?: string;
}

export function LanguageSwitcher({ variant = "icon", className }: LanguageSwitcherProps) {
  const { t, locale, setLocale } = useTranslation();

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        {variant === "icon" ? (
          <Button
            variant="outline"
            size="icon"
            className={className}
            aria-label={t("common.language")}
          >
            <Languages className="size-4" />
          </Button>
        ) : (
          <Button variant="ghost" size="sm" className={className}>
            <Languages className="size-4" aria-hidden />
            {localeLabel(locale)}
          </Button>
        )}
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        {LOCALES.map((code) => (
          <DropdownMenuItem
            key={code}
            disabled={code === locale}
            onSelect={() => setLocale(code)}
          >
            {localeLabel(code)}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

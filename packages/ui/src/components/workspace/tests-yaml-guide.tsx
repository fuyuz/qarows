import { useCallback, useState } from "react";
import { Copy } from "lucide-react";
import { cn } from "../../lib/cn";
import { useTranslation } from "../../i18n/context";
import { Button } from "../ui/button";
import { TESTS_YAML_AI_GUIDE } from "../../lib/tests-yaml-guide";

export function TestsYamlGuide() {
  const { t } = useTranslation();
  const [copied, setCopied] = useState(false);

  const handleCopy = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(TESTS_YAML_AI_GUIDE);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      setCopied(false);
    }
  }, []);

  return (
    <section
      className="mb-6 flex items-center justify-between gap-3 rounded-xl border bg-card px-4 py-3 shadow-sm"
      aria-labelledby="tests-yaml-guide-title"
    >
      <div className="min-w-0">
        <h2 id="tests-yaml-guide-title" className="text-sm font-semibold">
          {t("definition.yamlGuideTitle")}
        </h2>
        <p className="mt-0.5 text-xs text-muted-foreground">
          {t("definition.yamlGuideBody")}
        </p>
      </div>
      <Button
        type="button"
        variant="ghost"
        size="sm"
        className={cn(
          "h-7 shrink-0 gap-1.5 px-2 text-xs transition-colors duration-150 motion-reduce:transition-none",
          copied
            ? "text-green-600 hover:text-green-600 dark:text-green-500 dark:hover:text-green-500"
            : "text-muted-foreground hover:text-foreground",
        )}
        aria-label={copied ? t("definition.yamlGuideCopied") : t("definition.yamlGuideCopy")}
        onClick={() => void handleCopy()}
      >
        <Copy className="size-3.5" aria-hidden />
        {t("common.copy")}
      </Button>
    </section>
  );
}

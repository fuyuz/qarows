import { useCallback, useState } from "react";
import { Copy } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/cn";
import { TESTS_YAML_AI_GUIDE } from "@/lib/tests-yaml-guide";

export function TestsYamlGuide() {
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
          tests.yml の書き方
        </h2>
        <p className="mt-0.5 text-xs text-muted-foreground">
          AI に tests.yml を書かせるときは、仕様をコピーしてプロンプトに貼り付けてください。
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
        aria-label={copied ? "クリップボードにコピー済み" : "tests.yml 仕様をコピー"}
        onClick={() => void handleCopy()}
      >
        <Copy className="size-3.5" aria-hidden />
        コピー
      </Button>
    </section>
  );
}

import { useCallback, useState } from "react";
import { Check, Copy } from "lucide-react";
import { Button } from "@/components/ui/button";
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
        variant="outline"
        size="sm"
        className="shrink-0"
        onClick={() => void handleCopy()}
      >
        {copied ? (
          <>
            <Check className="size-3.5" aria-hidden />
            コピー済み
          </>
        ) : (
          <>
            <Copy className="size-3.5" aria-hidden />
            仕様をコピー
          </>
        )}
      </Button>
    </section>
  );
}

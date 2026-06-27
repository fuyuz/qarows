import type { SessionTestTargets, TestCase, TestDefinition, TestResults, TestStatus } from "@qarows/shared";
import { isResultEntryValid } from "@qarows/shared";
import { Bug, ClipboardList, Copy, Pencil } from "lucide-react";
import { useCallback, useState } from "react";
import { RUNNER_KEYBINDINGS } from "@/lib/runner-keybindings";
import { Kbd } from "@/components/qa-ui";
import {
  RunnerCardFooter,
  statusButtonClass,
  testCardShellClass,
  type RunnerCardNavProps,
} from "@/components/RunnerCardFooter";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/cn";

const STATUS_LABELS: Record<TestStatus, string> = {
  OK: "OK",
  NG: "NG",
  SKIP: "SKIP",
  OK_NG: "OK→NG",
};

function formatCategory(tc: TestCase): string {
  const parts = [tc.category.major];
  if (tc.category.medium) parts.push(tc.category.medium);
  if (tc.category.minor) parts.push(tc.category.minor);
  return parts.join(" › ");
}

export interface TestCardProps extends RunnerCardNavProps {
  testCase: TestCase;
  definition: TestDefinition;
  results: TestResults;
  envTargets: SessionTestTargets;
  memo: string;
  onMemoChange: (value: string) => void;
  onBatch: (status: TestStatus) => void;
  onSingle: (envId: string, status: TestStatus) => void;
  onClear: (envId: string) => void;
  onOpenBug: () => void;
  relatedBugCount: number;
  onViewRelatedBugs: () => void;
  needsRetest: boolean;
  onEditTestCase: () => void;
  onCopyTestCase: () => void | Promise<void>;
}

export function TestCard({
  testCase,
  definition,
  results,
  envTargets,
  memo,
  busy,
  canPrev,
  canNext,
  onPrev,
  onNext,
  onMemoChange,
  onBatch,
  onSingle,
  onClear,
  onOpenBug,
  relatedBugCount,
  onViewRelatedBugs,
  needsRetest,
  onEditTestCase,
  onCopyTestCase,
}: TestCardProps) {
  const [copied, setCopied] = useState(false);

  const handleCopy = useCallback(async () => {
    try {
      await onCopyTestCase();
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      setCopied(false);
    }
  }, [onCopyTestCase]);

  return (
    <article className={testCardShellClass()}>
      <header className="mb-0 shrink-0 border-b pb-3.5">
        <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
          <div className="flex min-w-0 flex-1 flex-wrap items-baseline gap-x-3 gap-y-1">
            <Badge variant="secondary" className="bg-primary/10 font-bold text-primary">
              {testCase.id}
            </Badge>
            {needsRetest && (
              <Badge variant="destructive" className="text-[0.65rem] font-bold">
                要再テスト
              </Badge>
            )}
            <span className="text-sm text-muted-foreground">{formatCategory(testCase)}</span>
          </div>
          <div className="flex shrink-0 items-center gap-1">
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="h-7 gap-1.5 px-2 text-xs text-muted-foreground hover:text-foreground"
              disabled={busy}
              onClick={onEditTestCase}
            >
              <Pencil className="size-3.5" aria-hidden />
              編集
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className={cn(
                "h-7 gap-1.5 px-2 text-xs transition-colors duration-150 motion-reduce:transition-none",
                copied
                  ? "text-green-600 hover:text-green-600 dark:text-green-500 dark:hover:text-green-500"
                  : "text-muted-foreground hover:text-foreground",
              )}
              disabled={busy}
              aria-label={copied ? "クリップボードにコピー済み" : "Markdown をコピー"}
              onClick={() => void handleCopy()}
            >
              <Copy className="size-3.5" aria-hidden />
              コピー
            </Button>
          </div>
        </div>
      </header>

      <div className="min-h-0 flex-1 overflow-y-auto pt-5 pb-3">
        {testCase.prerequisites && (
          <section className="mb-5">
            <h2 className="mb-1.5 text-xs font-semibold tracking-wide text-muted-foreground uppercase">
              前提条件
            </h2>
            <p className="text-sm leading-relaxed text-foreground/90">{testCase.prerequisites}</p>
          </section>
        )}

        <section className="mb-5">
          <h2 className="mb-1.5 text-xs font-semibold tracking-wide text-muted-foreground uppercase">
            確認内容
          </h2>
          <p className="text-lg leading-relaxed font-semibold text-foreground">{testCase.description}</p>
        </section>

        <section className="mb-5">
          <h2 className="mb-1.5 flex items-center gap-2 text-xs font-semibold tracking-wide text-muted-foreground uppercase">
            対象端末
            <Badge variant="outline" className="text-[0.65rem] font-bold lowercase">
              {envTargets.required === "any" ? "any" : "all"}
            </Badge>
          </h2>
          <ul className="flex flex-col gap-2">
            {envTargets.environmentIds.map((envId) => {
              const env = definition.environments.find((e) => e.id === envId);
              const entry = results[testCase.id]?.[envId];
              const isValid = isResultEntryValid(entry, testCase);
              const isIncomplete = !isValid;

              return (
                <li
                  key={envId}
                  className={cn(
                    "rounded-lg border px-3 py-2.5 transition-[background-color,border-color] duration-300 ease-in-out motion-reduce:transition-none",
                    isIncomplete
                      ? "border-primary/35 bg-card shadow-sm"
                      : "border-border bg-muted/30",
                  )}
                >
                  <div className="mb-2 flex items-center justify-between gap-2">
                    <span className="text-sm font-medium">{env?.name ?? envId}</span>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="h-7 px-2 text-xs text-muted-foreground hover:text-destructive"
                      disabled={busy || !isValid}
                      onClick={() => onClear(envId)}
                    >
                      クリア
                    </Button>
                  </div>
                  <div className="flex gap-1.5">
                    {(["OK", "NG", "SKIP"] as const).map((status) => (
                      <Button
                        key={status}
                        type="button"
                        variant="outline"
                        size="sm"
                        className={cn("h-auto flex-1 py-1.5", statusButtonClass(status, isValid && entry?.status === status))}
                        disabled={busy}
                        onClick={() => onSingle(envId, status)}
                      >
                        {STATUS_LABELS[status]}
                      </Button>
                    ))}
                  </div>
                </li>
              );
            })}
          </ul>
        </section>

        <section className="mb-5">
          <div className="mb-1.5 flex items-center justify-between gap-2">
            <label className="text-xs font-semibold tracking-wide text-muted-foreground uppercase" htmlFor={`test-memo-${testCase.id}`}>
              メモ
            </label>
            <div className="flex items-center gap-1">
              {relatedBugCount > 0 && (
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="h-7 gap-1.5 px-2 text-xs text-muted-foreground hover:text-foreground"
                  disabled={busy}
                  onClick={onViewRelatedBugs}
                >
                  <ClipboardList className="size-3.5" aria-hidden />
                  不具合 ({relatedBugCount})
                </Button>
              )}
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="h-7 gap-1.5 px-2 text-xs text-muted-foreground hover:text-foreground"
                disabled={busy}
                onClick={onOpenBug}
              >
                <Bug className="size-3.5" aria-hidden />
                バグ
              </Button>
            </div>
          </div>
          <div className="px-[3px]">
            <Textarea
              id={`test-memo-${testCase.id}`}
              rows={3}
              placeholder="任意"
              value={memo}
              onChange={(e) => onMemoChange(e.target.value)}
            />
          </div>
        </section>
      </div>

      <RunnerCardFooter
        canPrev={canPrev}
        canNext={canNext}
        busy={busy}
        onPrev={onPrev}
        onNext={onNext}
      >
        <Button
          variant="ok"
          className="h-auto flex-1 py-2.5 font-semibold"
          disabled={busy}
          onClick={() => onBatch("OK")}
        >
          一括 OK <Kbd className="ml-1 border-white/30 bg-white/20 text-inherit">{RUNNER_KEYBINDINGS.ok[0]}</Kbd>
        </Button>
        <Button
          variant="ng"
          className="h-auto flex-1 py-2.5 font-semibold"
          disabled={busy}
          onClick={() => onBatch("NG")}
        >
          一括 NG <Kbd className="ml-1 border-white/30 bg-white/20 text-inherit">{RUNNER_KEYBINDINGS.ng[0]}</Kbd>
        </Button>
      </RunnerCardFooter>
    </article>
  );
}

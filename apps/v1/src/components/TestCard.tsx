import type { SessionTestTargets, TestCase, TestDefinition, TestResults, TestStatus } from "@qarows/shared";
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
  flashEnvId?: string | null;
  onMemoChange: (value: string) => void;
  onBatch: (status: TestStatus) => void;
  onSingle: (envId: string, status: TestStatus) => void;
  onClear: (envId: string) => void;
}

export function TestCard({
  testCase,
  definition,
  results,
  envTargets,
  memo,
  flashEnvId,
  busy,
  canPrev,
  canNext,
  onPrev,
  onNext,
  onMemoChange,
  onBatch,
  onSingle,
  onClear,
}: TestCardProps) {
  return (
    <article className={testCardShellClass()}>
      <div className="min-h-0 flex-1 overflow-y-auto pb-3">
        <header className="mb-5 flex flex-wrap items-baseline gap-x-3 gap-y-1 border-b pb-3.5">
          <Badge variant="secondary" className="bg-primary/10 font-bold text-primary">
            {testCase.id}
          </Badge>
          <span className="text-sm text-muted-foreground">{formatCategory(testCase)}</span>
        </header>

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
              const isIncomplete = !entry?.status;
              const isFlashing = flashEnvId === envId;
              const flashClass =
                isFlashing && entry?.status === "NG"
                  ? "animate-ui-highlight-ng"
                  : isFlashing && entry?.status === "OK"
                    ? "animate-ui-highlight-ok"
                    : isFlashing
                      ? "animate-ui-highlight"
                      : undefined;

              return (
                <li
                  key={envId}
                  className={cn(
                    "rounded-lg border px-3 py-2.5 transition-colors duration-200",
                    isIncomplete
                      ? "border-primary/35 bg-card shadow-sm"
                      : "border-border bg-muted/30",
                    flashClass,
                  )}
                >
                  <div className="mb-2 flex items-center justify-between gap-2">
                    <span className="text-sm font-medium">{env?.name ?? envId}</span>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="h-7 px-2 text-xs text-muted-foreground hover:text-destructive"
                      disabled={busy || !entry?.status}
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
                        className={cn("h-auto flex-1 py-1.5", statusButtonClass(status, entry?.status === status))}
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
          <label className="mb-1.5 block text-xs font-semibold tracking-wide text-muted-foreground uppercase" htmlFor={`test-memo-${testCase.id}`}>
            メモ
          </label>
          <Textarea
            id={`test-memo-${testCase.id}`}
            rows={3}
            placeholder="任意"
            value={memo}
            onChange={(e) => onMemoChange(e.target.value)}
          />
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

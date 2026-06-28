import type { Bug, BugStatus, TestCase, TestDefinition } from "@qarows/shared";
import { BUG_SEVERITY_LABELS, BUG_STATUS_LABELS, getNextBugStatus } from "@qarows/shared";
import { Copy, Pencil } from "lucide-react";
import { useCallback, useState } from "react";
import {
  RunnerCardFooter,
  testCardShellClass,
  type RunnerCardNavProps,
} from "./RunnerCardFooter";
import { TestCaseHoverPreview } from "./TestCaseHoverPreview";
import { Badge } from "@qarows/ui";
import { Button } from "@qarows/ui";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@qarows/ui";
import { formatBugMarkdown } from "../lib/format-bug-markdown";
import { cn } from "@qarows/ui";

const BUG_STATUS_OPTIONS = Object.keys(BUG_STATUS_LABELS) as BugStatus[];

function severityBadgeClass(severity: Bug["severity"]): string {
  if (severity === "critical") return "border-transparent bg-red-600 text-white";
  if (severity === "high") return "border-transparent bg-orange-100 text-orange-900";
  if (severity === "medium") return "border-transparent bg-amber-100 text-amber-900";
  return "border-transparent bg-muted text-muted-foreground";
}

function BugField({
  label,
  value,
  placeholder = "—",
}: {
  label: string;
  value?: string;
  placeholder?: string;
}) {
  const text = value?.trim();
  return (
    <section className="mb-5">
      <h2 className="mb-1.5 text-xs font-semibold tracking-wide text-muted-foreground uppercase">
        {label}
      </h2>
      <p className="whitespace-pre-wrap text-sm leading-relaxed text-foreground/90">
        {text || placeholder}
      </p>
    </section>
  );
}

export function BugCard({
  bug,
  definition,
  relatedTestCase,
  busy,
  canPrev,
  canNext,
  onPrev,
  onNext,
  onStatusChange,
  onAdvanceStatus,
  onEdit,
  onNavigateToTestCase,
}: {
  bug: Bug;
  definition: TestDefinition;
  relatedTestCase?: TestCase;
  onStatusChange: (status: BugStatus) => void;
  onAdvanceStatus?: () => void;
  onEdit: () => void;
  onNavigateToTestCase?: () => void;
  busy?: boolean;
} & RunnerCardNavProps) {
  const [copied, setCopied] = useState(false);
  const nextStatus = getNextBugStatus(bug.status);

  const envNames = (bug.environmentIds ?? [])
    .map((id) => definition.environments.find((env) => env.id === id)?.name ?? id)
    .join("、");

  const handleCopy = useCallback(async () => {
    try {
      const markdown = formatBugMarkdown({ definition, bug, relatedTestCase });
      await navigator.clipboard.writeText(markdown);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      setCopied(false);
    }
  }, [bug, definition, relatedTestCase]);

  return (
    <article className={testCardShellClass()}>
      <header className="mb-0 shrink-0 border-b pb-3.5">
        <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
          <Badge variant="secondary" className="bg-primary/10 font-bold text-primary">
            {bug.id}
          </Badge>
          <Badge className={severityBadgeClass(bug.severity)}>
            {BUG_SEVERITY_LABELS[bug.severity]}
          </Badge>
          <div className="flex min-w-36 items-center gap-2">
            <span className="text-xs font-semibold text-muted-foreground">対応状況</span>
            <Select
              value={bug.status}
              disabled={busy}
              onValueChange={(value) => onStatusChange(value as BugStatus)}
            >
              <SelectTrigger className="h-auto min-w-28 px-2.5 py-1.5 text-sm font-semibold">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {BUG_STATUS_OPTIONS.map((status) => (
                  <SelectItem key={status} value={status}>
                    {BUG_STATUS_LABELS[status]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="ml-auto flex shrink-0 items-center gap-1">
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="h-7 gap-1.5 px-2 text-xs text-muted-foreground hover:text-foreground"
              disabled={busy}
              onClick={onEdit}
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
        <h1 className="mt-3 text-lg leading-snug font-semibold text-foreground">{bug.title}</h1>
      </header>

      <div className="min-h-0 flex-1 overflow-y-auto pt-5 pb-3">
        <section className="mb-5">
          <h2 className="mb-1.5 text-xs font-semibold tracking-wide text-muted-foreground uppercase">
            関連テスト
          </h2>
          {relatedTestCase ? (
            <TestCaseHoverPreview testCase={relatedTestCase}>
              {onNavigateToTestCase ? (
                <button
                  type="button"
                  className="inline-flex rounded-md focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
                  title="クリックでテスト実行へ"
                  onClick={onNavigateToTestCase}
                >
                  <Badge
                    variant="outline"
                    className="cursor-pointer font-bold text-primary hover:bg-primary/5"
                  >
                    {relatedTestCase.id}
                  </Badge>
                </button>
              ) : (
                <Badge
                  variant="outline"
                  className="cursor-default font-bold text-primary hover:bg-primary/5"
                >
                  {relatedTestCase.id}
                </Badge>
              )}
            </TestCaseHoverPreview>
          ) : bug.testCaseId ? (
            <Badge variant="outline" className="font-bold text-muted-foreground">
              {bug.testCaseId}
            </Badge>
          ) : (
            <p className="text-sm text-muted-foreground">なし</p>
          )}
        </section>

        <section className="mb-5">
          <h2 className="mb-1.5 text-xs font-semibold tracking-wide text-muted-foreground uppercase">
            対象端末 / 環境
          </h2>
          <p className="text-sm leading-relaxed text-foreground/90">{envNames || "—"}</p>
        </section>

        {bug.assignee && (
          <section className="mb-5">
            <h2 className="mb-1.5 text-xs font-semibold tracking-wide text-muted-foreground uppercase">
              担当者
            </h2>
            <p className="text-sm leading-relaxed text-foreground/90">{bug.assignee}</p>
          </section>
        )}

        <BugField label="再現手順" value={bug.steps} />
        <BugField label="期待" value={bug.expected} />
        <BugField label="実際" value={bug.actual} placeholder="—" />
        <BugField label="メモ" value={bug.memo} placeholder="—" />
        {bug.fixNote && <BugField label="修正内容" value={bug.fixNote} />}
      </div>

      <RunnerCardFooter
        canPrev={canPrev}
        canNext={canNext}
        busy={busy}
        onPrev={onPrev}
        onNext={onNext}
      >
        {nextStatus && onAdvanceStatus && (
          <Button
            type="button"
            variant="default"
            className="h-auto flex-1 py-2.5 font-semibold"
            disabled={busy}
            onClick={onAdvanceStatus}
          >
            {BUG_STATUS_LABELS[nextStatus]}にする
          </Button>
        )}
      </RunnerCardFooter>
    </article>
  );
}

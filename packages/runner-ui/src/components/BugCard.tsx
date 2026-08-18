import type { Bug, BugStatus, TestCase, TestDefinition } from "@qarows/shared";
import { getNextBugStatus, isImageAttachment } from "@qarows/shared";
import { Copy, ImageOff, Pencil } from "lucide-react";
import { useCallback, useState } from "react";
import { useTranslation } from "@qarows/ui";
import { useRunnerWorkspace, type BugAttachmentsAdapter } from "../context/runner-workspace";
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
import { useBugLabels } from "../hooks/useBugLabels";
import { cn } from "@qarows/ui";

const BUG_STATUS_OPTIONS: BugStatus[] = ["open", "in_progress", "fixed", "resolved", "wont_fix"];

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

function BugAttachmentsSection({
  bug,
  adapter,
}: {
  bug: Bug;
  adapter: BugAttachmentsAdapter;
}) {
  const { t } = useTranslation();
  const [missingKeys, setMissingKeys] = useState<Set<string>>(new Set());
  const attachments = bug.attachments ?? [];
  if (attachments.length === 0) return null;

  const markMissing = (key: string) => {
    setMissingKeys((prev) => new Set(prev).add(key));
  };

  return (
    <section className="mb-5">
      <h2 className="mb-1.5 text-xs font-semibold tracking-wide text-muted-foreground uppercase">
        {t("bug.attachments")}
      </h2>
      <ul className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        {attachments.map((attachment) => (
          <li key={attachment.key} className="overflow-hidden rounded-lg border">
            {missingKeys.has(attachment.key) ? (
              <div className="flex h-32 flex-col items-center justify-center gap-2 bg-muted/40 px-3 text-center">
                <ImageOff className="size-5 text-muted-foreground/60" aria-hidden />
                <p className="text-xs text-muted-foreground">{t("bug.attachmentMissing")}</p>
              </div>
            ) : isImageAttachment(attachment.mimeType) ? (
              <a href={adapter.url(attachment.key)} target="_blank" rel="noreferrer">
                <img
                  src={adapter.url(attachment.key)}
                  alt={attachment.name}
                  loading="lazy"
                  className="max-h-64 w-full bg-muted/40 object-contain"
                  onError={() => markMissing(attachment.key)}
                />
              </a>
            ) : (
              <video
                src={adapter.url(attachment.key)}
                controls
                preload="metadata"
                playsInline
                className="max-h-64 w-full bg-black"
                onError={() => markMissing(attachment.key)}
              />
            )}
            <p className="truncate px-2.5 py-1.5 text-xs text-muted-foreground" title={attachment.name}>
              {attachment.name}
            </p>
          </li>
        ))}
      </ul>
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
  const { t } = useTranslation();
  const { statusLabels, severityLabels } = useBugLabels();
  const { attachments: attachmentsAdapter } = useRunnerWorkspace();
  const [copied, setCopied] = useState(false);
  const nextStatus = getNextBugStatus(bug.status);

  const envNames = (bug.environmentIds ?? [])
    .map((id) => definition.environments.find((env) => env.id === id)?.name ?? id)
    .join("、");

  const handleCopy = useCallback(async () => {
    try {
      const markdown = formatBugMarkdown({ definition, bug, relatedTestCase, t });
      await navigator.clipboard.writeText(markdown);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      setCopied(false);
    }
  }, [bug, definition, relatedTestCase, t]);

  return (
    <article className={testCardShellClass()}>
      <header className="mb-0 shrink-0 border-b pb-3.5">
        <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
          <Badge variant="secondary" className="bg-primary/10 font-bold text-primary">
            {bug.id}
          </Badge>
          <Badge className={severityBadgeClass(bug.severity)}>
            {severityLabels[bug.severity]}
          </Badge>
          <div className="flex min-w-36 items-center gap-2">
            <span className="text-xs font-semibold text-muted-foreground">{t("bug.statusSection")}</span>
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
                    {statusLabels[status]}
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
              {t("common.edit")}
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
              aria-label={copied ? t("runner.copyMarkdownDone") : t("runner.copyMarkdown")}
              onClick={() => void handleCopy()}
            >
              <Copy className="size-3.5" aria-hidden />
              {copied ? t("common.copied") : t("common.copy")}
            </Button>
          </div>
        </div>
        <h1 className="mt-3 text-lg leading-snug font-semibold text-foreground">{bug.title}</h1>
      </header>

      <div className="min-h-0 flex-1 overflow-y-auto pt-5 pb-3">
        <section className="mb-5">
          <h2 className="mb-1.5 text-xs font-semibold tracking-wide text-muted-foreground uppercase">
            {t("bug.relatedTests")}
          </h2>
          {relatedTestCase ? (
            <TestCaseHoverPreview testCase={relatedTestCase}>
              {onNavigateToTestCase ? (
                <button
                  type="button"
                  className="inline-flex rounded-md focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
                  title={t("bug.clickToRun")}
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
            <p className="text-sm text-muted-foreground">{t("common.none")}</p>
          )}
        </section>

        <section className="mb-5">
          <h2 className="mb-1.5 text-xs font-semibold tracking-wide text-muted-foreground uppercase">
            {t("bug.targetEnvironments")}
          </h2>
          <p className="text-sm leading-relaxed text-foreground/90">{envNames || "—"}</p>
        </section>

        {bug.assignee && (
          <section className="mb-5">
            <h2 className="mb-1.5 text-xs font-semibold tracking-wide text-muted-foreground uppercase">
              {t("bug.assignee")}
            </h2>
            <p className="text-sm leading-relaxed text-foreground/90">{bug.assignee}</p>
          </section>
        )}

        <BugField label={t("bug.reproSteps")} value={bug.steps} />
        <BugField label={t("bug.expected")} value={bug.expected} />
        <BugField label={t("bug.actual")} value={bug.actual} placeholder="—" />
        {attachmentsAdapter && <BugAttachmentsSection bug={bug} adapter={attachmentsAdapter} />}
        <BugField label={t("runner.memo")} value={bug.memo} placeholder="—" />
        {bug.fixNote && <BugField label={t("bug.fixNote")} value={bug.fixNote} />}
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
            {t("bug.markAs", { status: statusLabels[nextStatus] })}
          </Button>
        )}
      </RunnerCardFooter>
    </article>
  );
}

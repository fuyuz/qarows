import type { Bug, TestCase, TestDefinition } from "@qarows/shared";
import { BUG_SEVERITY_LABELS, BUG_STATUS_LABELS } from "@qarows/shared";
import {
  RunnerCardFooter,
  testCardShellClass,
  type RunnerCardNavProps,
} from "@/components/RunnerCardFooter";
import { TestCaseHoverPreview } from "@/components/TestCaseHoverPreview";
import { Badge } from "@/components/ui/badge";

function severityBadgeClass(severity: Bug["severity"]): string {
  if (severity === "critical") return "border-transparent bg-red-600 text-white";
  if (severity === "high") return "border-transparent bg-orange-100 text-orange-900";
  if (severity === "medium") return "border-transparent bg-amber-100 text-amber-900";
  return "border-transparent bg-muted text-muted-foreground";
}

function statusBadgeClass(status: Bug["status"]): string {
  if (status === "resolved") return "border-transparent bg-green-100 text-green-800";
  if (status === "fixed" || status === "pending_verification") {
    return "border-transparent bg-blue-100 text-blue-800";
  }
  if (status === "in_progress") return "border-transparent bg-orange-100 text-orange-900";
  return "border-transparent bg-red-100 text-red-800";
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
}: {
  bug: Bug;
  definition: TestDefinition;
  relatedTestCase?: TestCase;
  busy?: boolean;
} & RunnerCardNavProps) {
  const envNames = (bug.environmentIds ?? [])
    .map((id) => definition.environments.find((env) => env.id === id)?.name ?? id)
    .join("、");

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
          <Badge className={statusBadgeClass(bug.status)}>{BUG_STATUS_LABELS[bug.status]}</Badge>
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
              <Badge
                variant="outline"
                className="cursor-default font-bold text-primary hover:bg-primary/5"
              >
                {relatedTestCase.id}
              </Badge>
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
      </div>

      <RunnerCardFooter
        canPrev={canPrev}
        canNext={canNext}
        busy={busy}
        onPrev={onPrev}
        onNext={onNext}
      />
    </article>
  );
}

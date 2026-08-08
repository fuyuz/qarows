import { useMemo } from "react";
import { BUG_STATUS_DISPLAY_ORDER, type Bug, type BugStatus } from "@qarows/shared";
import { useTranslation } from "@qarows/ui";
import { useRunnerWorkspace } from "../context/runner-workspace";
import { useRunnerQueryState } from "../hooks/useRunnerQueryState";
import { useBugLabels } from "../hooks/useBugLabels";
import { resolveFilteredBugs } from "../lib/bug-filter";
import { getAllEnvironmentIds } from "../lib/run-progress";
import { formatRunnerFilterTitle } from "../lib/runner-utils";
import { cn } from "@qarows/ui";

const STATUS_COLORS: Record<BugStatus, string> = {
  open: "bg-red-500",
  in_progress: "bg-orange-500",
  fixed: "bg-blue-500",
  resolved: "bg-green-500",
  wont_fix: "bg-stone-400",
};

function countByStatus(bugs: Bug[]): Record<BugStatus, number> {
  const counts: Record<BugStatus, number> = {
    open: 0,
    in_progress: 0,
    fixed: 0,
    resolved: 0,
    wont_fix: 0,
  };
  for (const bug of bugs) {
    counts[bug.status] += 1;
  }
  return counts;
}

function BugStatusRow({
  id,
  title,
  bugs,
}: {
  id: string;
  title: string;
  bugs: Bug[];
}) {
  const { t } = useTranslation();
  const { statusLabels } = useBugLabels();
  const total = bugs.length;
  const counts = useMemo(() => countByStatus(bugs), [bugs]);

  if (total === 0) {
    return (
      <div className="text-xs text-muted-foreground">
        <span className="font-semibold text-foreground/80">{title}</span>
        <span className="ml-2">{t("bug.noBugs")}</span>
      </div>
    );
  }

  return (
    <div>
      <div className="mb-1 flex items-baseline justify-between gap-2 text-xs">
        <span className="font-semibold text-foreground/80">{title}</span>
        <span className="tabular-nums text-muted-foreground">{t("common.count", { n: total })}</span>
      </div>
      <div
        id={id}
        className="flex h-2.5 overflow-hidden rounded-full bg-muted"
        role="img"
        aria-label={t("runner.progressAriaTotal", { title, n: total })}
      >
        {BUG_STATUS_DISPLAY_ORDER.map((status) => {
          const count = counts[status];
          if (count === 0) return null;
          const widthPct = (count / total) * 100;
          return (
            <div
              key={status}
              className={cn("h-full transition-[width] duration-300", STATUS_COLORS[status])}
              style={{ width: `${widthPct}%` }}
              title={t("runner.progressBucketCount", { label: statusLabels[status], n: count })}
            />
          );
        })}
      </div>
    </div>
  );
}

export function BugProgressBar() {
  const { t } = useTranslation();
  const { definition, results, session } = useRunnerWorkspace();
  const { runnerFilters, bugFilters } = useRunnerQueryState();

  const allEnvIds = useMemo(
    () => (definition ? getAllEnvironmentIds(definition) : []),
    [definition],
  );

  const { overall, filtered } = useMemo(() => {
    if (!definition || !results) {
      return { overall: [] as Bug[], filtered: [] as Bug[] };
    }
    const filteredBugs = resolveFilteredBugs(
      definition,
      runnerFilters,
      results.bugs,
      results.results,
      allEnvIds,
      session,
      bugFilters,
    );
    return { overall: results.bugs, filtered: filteredBugs };
  }, [allEnvIds, bugFilters, definition, results, runnerFilters, session]);

  if (!definition || !results || overall.length === 0) return null;

  const filterTitle = formatRunnerFilterTitle(definition, runnerFilters, t);

  return (
    <footer
      className="fixed inset-x-0 bottom-0 z-20 flex flex-col gap-1.5 border-t bg-card px-5 py-2 shadow-[0_-2px_10px_rgb(0_0_0/6%)]"
      aria-label={t("bug.progress")}
    >
      <BugStatusRow id="bug-progress-filter" title={filterTitle} bugs={filtered} />
      <BugStatusRow id="bug-progress-overall" title={t("common.overall")} bugs={overall} />
    </footer>
  );
}

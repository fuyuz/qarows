import {
  formatRate,
  progressSegmentLabels,
  type CategoryProgressRow,
  PROGRESS_SEGMENT_ORDER,
} from "../lib/run-progress";
import { useTranslation } from "@qarows/ui";
import {
  ProgressTrack,
  progressBucketBgClass,
  progressBucketTextClass,
} from "./ProgressRow";
import { cn } from "@qarows/ui";

const RATE_BUCKETS = ["OK", "NG", "SKIP", "incomplete"] as const;

export function CategoryStatsTable({
  rows,
  onMajorClick,
}: {
  rows: CategoryProgressRow[];
  onMajorClick?: (major: string) => void;
}) {
  const { t } = useTranslation();

  if (rows.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">{t("runner.noMajorData")}</p>
    );
  }

  return (
    <div className="overflow-x-auto rounded-xl border bg-card">
      <table className="w-full min-w-[640px] border-collapse text-left text-sm">
        <thead>
          <tr className="border-b bg-card">
            <th className="px-3 py-2.5 text-xs font-semibold text-muted-foreground">{t("runner.majorCol")}</th>
            <th className="px-3 py-2.5 text-xs font-semibold text-muted-foreground tabular-nums">
              {t("runner.countCol")}
            </th>
            <th className="px-3 py-2.5 text-xs font-semibold text-muted-foreground tabular-nums">
              {t("runner.okRate")}
            </th>
            <th className="px-3 py-2.5 text-xs font-semibold text-muted-foreground tabular-nums">
              {t("runner.ngRate")}
            </th>
            <th className="px-3 py-2.5 text-xs font-semibold text-muted-foreground tabular-nums">
              {t("runner.skipRate")}
            </th>
            <th className="px-3 py-2.5 text-xs font-semibold text-muted-foreground tabular-nums">
              {t("runner.notRunRate")}
            </th>
            <th className="min-w-[120px] px-3 py-2.5 text-xs font-semibold text-muted-foreground">
              {t("runner.breakdown")}
            </th>
          </tr>
        </thead>
        <tbody>
          {rows.map(({ major, stats }) => (
            <tr
              key={major}
              className={cn(
                "border-b border-border/40 last:border-b-0",
                onMajorClick &&
                  "cursor-pointer transition-colors hover:bg-muted/50 focus-visible:bg-muted/50 focus-visible:outline-none",
              )}
              tabIndex={onMajorClick ? 0 : undefined}
              onClick={onMajorClick ? () => onMajorClick(major) : undefined}
              onKeyDown={
                onMajorClick
                  ? (event) => {
                      if (event.key === "Enter" || event.key === " ") {
                        event.preventDefault();
                        onMajorClick(major);
                      }
                    }
                  : undefined
              }
              title={onMajorClick ? t("runner.clickMajorFilter") : undefined}
            >
              <td
                className={cn(
                  "px-3 py-2.5 text-sm font-semibold",
                  onMajorClick && "text-primary",
                )}
              >
                {major}
              </td>
              <td className="px-3 py-2.5 tabular-nums text-sm">{stats.total}</td>
              {RATE_BUCKETS.map((bucket) => (
                <td
                  key={bucket}
                  className={cn(
                    "px-3 py-2.5 tabular-nums text-sm font-semibold",
                    progressBucketTextClass(bucket),
                  )}
                >
                  {formatRate(stats.buckets[bucket], stats.total)}
                </td>
              ))}
              <td className="px-3 py-2.5">
                <ProgressTrack stats={stats} />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function CategoryStatsLegend() {
  const { t } = useTranslation();
  const segmentLabels = progressSegmentLabels(t);

  return (
    <div className="flex flex-wrap gap-3 text-xs text-muted-foreground">
      {PROGRESS_SEGMENT_ORDER.map((bucket) => (
        <span key={bucket} className="flex items-center gap-1.5">
          <span className={cn("size-2 rounded-full", progressBucketBgClass(bucket))} />
          {segmentLabels[bucket]}
        </span>
      ))}
    </div>
  );
}

import {
  formatRate,
  type CategoryProgressRow,
  PROGRESS_SEGMENT_ORDER,
} from "@/lib/run-progress";
import {
  ProgressTrack,
  progressBucketBgClass,
  progressBucketTextClass,
} from "@/components/ProgressRow";
import { cn } from "@/lib/cn";

const RATE_BUCKETS = ["OK", "NG", "SKIP", "incomplete"] as const;

export function CategoryStatsTable({
  rows,
  onMajorClick,
}: {
  rows: CategoryProgressRow[];
  onMajorClick?: (major: string) => void;
}) {
  if (rows.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">大項目のデータがありません</p>
    );
  }

  return (
    <div className="overflow-x-auto rounded-xl border bg-card">
      <table className="w-full min-w-[640px] border-collapse text-left text-sm">
        <thead>
          <tr className="border-b bg-card">
            <th className="px-3 py-2.5 text-xs font-semibold text-muted-foreground">大項目</th>
            <th className="px-3 py-2.5 text-xs font-semibold text-muted-foreground tabular-nums">
              件数
            </th>
            <th className="px-3 py-2.5 text-xs font-semibold text-muted-foreground tabular-nums">
              OK率
            </th>
            <th className="px-3 py-2.5 text-xs font-semibold text-muted-foreground tabular-nums">
              NG率
            </th>
            <th className="px-3 py-2.5 text-xs font-semibold text-muted-foreground tabular-nums">
              SKIP率
            </th>
            <th className="px-3 py-2.5 text-xs font-semibold text-muted-foreground tabular-nums">
              未実施率
            </th>
            <th className="min-w-[120px] px-3 py-2.5 text-xs font-semibold text-muted-foreground">
              内訳
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
              title={onMajorClick ? "クリックでテスト実行へ（大項目で絞り込み）" : undefined}
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
  return (
    <div className="flex flex-wrap gap-3 text-xs text-muted-foreground">
      {PROGRESS_SEGMENT_ORDER.map((bucket) => (
        <span key={bucket} className="flex items-center gap-1.5">
          <span className={cn("size-2 rounded-full", progressBucketBgClass(bucket))} />
          {bucket === "incomplete" ? "未実施" : bucket}
        </span>
      ))}
    </div>
  );
}

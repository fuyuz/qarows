import { useMemo, useState } from "react";
import { useApp } from "@/context/AppContext";
import {
  computeRunProgress,
  computeRunProgressForTestCases,
  PROGRESS_SEGMENT_LABELS,
  PROGRESS_SEGMENT_ORDER,
  type ProgressBucket,
  type RunProgressStats,
} from "@/lib/run-progress";
import { filterTestCases, formatRunnerFilterTitle } from "@/lib/utils";
import { cn } from "@/lib/cn";

function bucketClass(bucket: ProgressBucket): string {
  if (bucket === "OK") return "bg-green-600";
  if (bucket === "NG") return "bg-red-600";
  if (bucket === "SKIP") return "bg-stone-500";
  if (bucket === "OK_NG") return "bg-orange-600";
  return "bg-border";
}

function progressSummary(stats: RunProgressStats): string {
  if (stats.total === 0) return "0 件";
  const remaining = stats.total - stats.completed;
  const base = `${stats.completed} / ${stats.total} 完了`;
  return remaining > 0 ? `${base}（残り ${remaining}）` : base;
}

function ProgressTrack({
  stats,
  labelId,
  hoveredBucket,
  onHoverBucket,
  onHoverTrack,
}: {
  stats: RunProgressStats;
  labelId: string;
  hoveredBucket: ProgressBucket | null;
  onHoverBucket: (bucket: ProgressBucket, anchorX: number) => void;
  onHoverTrack: (anchorX: number) => void;
}) {
  if (stats.total === 0) {
    return (
      <div
        className="flex h-2.5 overflow-hidden rounded-full bg-muted"
        role="progressbar"
        aria-labelledby={labelId}
        aria-valuenow={0}
        aria-valuemin={0}
        aria-valuemax={0}
        onMouseEnter={(event) => onHoverTrack(event.currentTarget.offsetWidth / 2)}
      >
        <div className="h-full w-full bg-border" />
      </div>
    );
  }

  const segments = PROGRESS_SEGMENT_ORDER;

  return (
    <div
      className="flex h-2.5 overflow-hidden rounded-full bg-muted"
      role="progressbar"
      aria-labelledby={labelId}
      aria-valuenow={stats.completed}
      aria-valuemin={0}
      aria-valuemax={stats.total}
      aria-label={progressSummary(stats)}
    >
      {segments.map((key) => {
        const widthPct = (stats.buckets[key] / stats.total) * 100;
        return (
          <div
            key={key}
            className={cn(
              "h-full transition-[width,filter] duration-600 ease-in-out",
              widthPct > 0 ? "min-w-0.5" : "min-w-0",
              bucketClass(key),
              hoveredBucket === key && widthPct > 0 && "brightness-110",
            )}
            style={{ width: `${widthPct}%` }}
            onMouseEnter={(event) => {
              if (widthPct <= 0) return;
              onHoverBucket(key, event.currentTarget.offsetLeft + event.currentTarget.offsetWidth / 2);
            }}
          />
        );
      })}
    </div>
  );
}

function ProgressRow({
  id,
  title,
  stats,
}: {
  id: string;
  title: string;
  stats: RunProgressStats;
}) {
  const [hover, setHover] = useState<{ bucket: ProgressBucket | null; anchorX: number } | null>(
    null,
  );

  return (
    <div className="flex flex-col gap-1">
      <div className="flex items-center justify-between gap-2">
        <span className="text-xs font-semibold text-muted-foreground" id={id}>
          {title}
        </span>
        <span
          key={`${stats.completed}-${stats.total}`}
          className="animate-in fade-in duration-600 text-xs font-semibold tabular-nums"
        >
          <span className="text-foreground">{stats.completed}</span>
          <span className="text-muted-foreground"> / {stats.total}</span>
          {stats.total - stats.completed > 0 && (
            <span className="text-primary"> 残り {stats.total - stats.completed}</span>
          )}
        </span>
      </div>
      <div className="relative" onMouseLeave={() => setHover(null)}>
        {hover && (
          <div
            className="pointer-events-none absolute bottom-[calc(100%+0.4rem)] z-10 flex -translate-x-1/2 flex-col items-center gap-0.5 rounded-md bg-stone-900 px-2 py-1 text-[0.72rem] font-medium whitespace-nowrap text-stone-50"
            style={{ left: hover.anchorX }}
          >
            {hover.bucket != null && (
              <span className="font-semibold">
                {PROGRESS_SEGMENT_LABELS[hover.bucket]} {stats.buckets[hover.bucket]}件
              </span>
            )}
            <span className="text-[0.68rem] text-stone-300">{progressSummary(stats)}</span>
          </div>
        )}
        <ProgressTrack
          stats={stats}
          labelId={id}
          hoveredBucket={hover?.bucket ?? null}
          onHoverBucket={(bucket, anchorX) => setHover({ bucket, anchorX })}
          onHoverTrack={(anchorX) => setHover({ bucket: null, anchorX })}
        />
      </div>
    </div>
  );
}

export function RunProgressBar() {
  const { definition, results, session, runnerFilters } = useApp();

  const { overall, filtered } = useMemo(() => {
    const empty = { total: 0, completed: 0, buckets: { incomplete: 0, OK: 0, NG: 0, SKIP: 0, OK_NG: 0 } };
    if (!definition || !results || !session) {
      return { overall: empty, filtered: empty };
    }

    const sessionEnvIds = session.selectedEnvironmentIds;
    const overallStats = computeRunProgress(definition, sessionEnvIds, results.results);

    const filterScopeCases = filterTestCases(
      definition,
      session,
      { ...runnerFilters, onlyIncomplete: false },
      results.results,
    );
    const filteredStats = computeRunProgressForTestCases(
      filterScopeCases,
      definition,
      sessionEnvIds,
      results.results,
    );

    return { overall: overallStats, filtered: filteredStats };
  }, [definition, results, session, runnerFilters]);

  if (!definition || !session || overall.total === 0) return null;

  const filterTitle = formatRunnerFilterTitle(definition, runnerFilters);

  return (
    <footer className="fixed inset-x-0 bottom-0 z-20 flex flex-col gap-1.5 border-t bg-card px-5 py-2 shadow-[0_-2px_10px_rgb(0_0_0/6%)]" aria-label="テスト進捗">
      <ProgressRow id="run-progress-filter" title={filterTitle} stats={filtered} />
      <ProgressRow id="run-progress-overall" title="全体" stats={overall} />
    </footer>
  );
}

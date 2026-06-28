import { useState } from "react";
import {
  PROGRESS_SEGMENT_LABELS,
  PROGRESS_SEGMENT_ORDER,
  type ProgressBucket,
  type RunProgressStats,
} from "../lib/run-progress";
import { cn } from "@qarows/ui";

export function progressBucketBgClass(bucket: ProgressBucket): string {
  if (bucket === "OK") return "bg-green-600";
  if (bucket === "NG") return "bg-red-600";
  if (bucket === "SKIP") return "bg-stone-500";
  return "bg-border";
}

export function progressBucketTextClass(bucket: ProgressBucket): string {
  if (bucket === "OK") return "text-green-600";
  if (bucket === "NG") return "text-red-600";
  if (bucket === "SKIP") return "text-stone-500";
  return "text-muted-foreground";
}

function bucketClass(bucket: ProgressBucket): string {
  return progressBucketBgClass(bucket);
}

export function progressSummary(stats: RunProgressStats): string {
  if (stats.total === 0) return "0 件";
  const remaining = stats.total - stats.completed;
  const base = `${stats.completed} / ${stats.total} 完了`;
  return remaining > 0 ? `${base}（残り ${remaining}）` : base;
}

export function ProgressTrack({
  stats,
  labelId,
  hoveredBucket,
  onHoverBucket,
  onHoverTrack,
  className,
}: {
  stats: RunProgressStats;
  labelId?: string;
  hoveredBucket?: ProgressBucket | null;
  onHoverBucket?: (bucket: ProgressBucket, anchorX: number) => void;
  onHoverTrack?: (anchorX: number) => void;
  className?: string;
}) {
  if (stats.total === 0) {
    return (
      <div
        className={cn("flex h-2.5 overflow-hidden rounded-full bg-muted", className)}
        role="progressbar"
        aria-labelledby={labelId}
        aria-valuenow={0}
        aria-valuemin={0}
        aria-valuemax={0}
        onMouseEnter={(event) => onHoverTrack?.(event.currentTarget.offsetWidth / 2)}
      >
        <div className="h-full w-full bg-border" />
      </div>
    );
  }

  return (
    <div
      className={cn("flex h-2.5 overflow-hidden rounded-full bg-muted", className)}
      role="progressbar"
      aria-labelledby={labelId}
      aria-valuenow={stats.completed}
      aria-valuemin={0}
      aria-valuemax={stats.total}
      aria-label={progressSummary(stats)}
    >
      {PROGRESS_SEGMENT_ORDER.map((key) => {
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
              onHoverBucket?.(
                key,
                event.currentTarget.offsetLeft + event.currentTarget.offsetWidth / 2,
              );
            }}
          />
        );
      })}
    </div>
  );
}

export function ProgressRow({
  id,
  title,
  stats,
  showTooltip = true,
}: {
  id: string;
  title: string;
  stats: RunProgressStats;
  showTooltip?: boolean;
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
        {showTooltip && hover && (
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

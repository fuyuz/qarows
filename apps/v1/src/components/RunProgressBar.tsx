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
import { filterTestCases } from "@/lib/utils";

function bucketClass(bucket: ProgressBucket): string {
  if (bucket === "OK_NG") return "ok-ng";
  if (bucket === "incomplete") return "incomplete";
  return bucket.toLowerCase();
}

function progressSummary(stats: RunProgressStats): string {
  if (stats.total === 0) return "0 件";
  return `${stats.completed} / ${stats.total} 完了`;
}

function formatFilterTitle(filters: {
  majorCategoryFilter?: string;
  mediumCategoryFilter?: string;
}): string {
  const parts = [filters.majorCategoryFilter, filters.mediumCategoryFilter].filter(Boolean);
  if (parts.length === 0) return "フィルタ";
  return `フィルタ（${parts.join(" › ")}）`;
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
        className="run-progress__track run-progress__track--empty"
        role="progressbar"
        aria-labelledby={labelId}
        aria-valuenow={0}
        aria-valuemin={0}
        aria-valuemax={0}
        onMouseEnter={(event) => onHoverTrack(event.currentTarget.offsetWidth / 2)}
      >
        <div className="run-progress__segment run-progress__segment--incomplete" style={{ width: "100%" }} />
      </div>
    );
  }

  const segments = PROGRESS_SEGMENT_ORDER.filter((key) => stats.buckets[key] > 0);

  return (
    <div
      className="run-progress__track"
      role="progressbar"
      aria-labelledby={labelId}
      aria-valuenow={stats.completed}
      aria-valuemin={0}
      aria-valuemax={stats.total}
      aria-label={progressSummary(stats)}
    >
      {segments.map((key) => (
        <div
          key={key}
          className={`run-progress__segment run-progress__segment--${bucketClass(key)}${
            hoveredBucket === key ? " run-progress__segment--hovered" : ""
          }`}
          style={{ width: `${(stats.buckets[key] / stats.total) * 100}%` }}
          onMouseEnter={(event) =>
            onHoverBucket(key, event.currentTarget.offsetLeft + event.currentTarget.offsetWidth / 2)
          }
        />
      ))}
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
    <div className="run-progress__row">
      <div
        className="run-progress__track-wrap"
        onMouseLeave={() => setHover(null)}
      >
        {hover && (
          <div className="run-progress__tooltip" style={{ left: hover.anchorX }}>
            {hover.bucket != null && (
              <span className="run-progress__tooltip-segment">
                {PROGRESS_SEGMENT_LABELS[hover.bucket]} {stats.buckets[hover.bucket]}件
              </span>
            )}
            <span className="run-progress__tooltip-summary">{progressSummary(stats)}</span>
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
      <span className="run-progress__row-title" id={id}>
        {title}
      </span>
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

  const filterTitle = formatFilterTitle(runnerFilters);

  return (
    <footer className="run-progress" aria-label="テスト進捗">
      <ProgressRow id="run-progress-filter" title={filterTitle} stats={filtered} />
      <ProgressRow id="run-progress-overall" title="全体" stats={overall} />
    </footer>
  );
}

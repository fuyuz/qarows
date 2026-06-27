import type { ReactNode } from "react";

function ChevronIcon({ direction }: { direction: "prev" | "next" }) {
  return (
    <svg className="test-card__nav-icon" viewBox="0 0 24 24" aria-hidden="true">
      {direction === "prev" ? (
        <path
          d="M15 18l-6-6 6-6"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      ) : (
        <path
          d="M9 18l6-6-6-6"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      )}
    </svg>
  );
}

export interface RunnerCardNavProps {
  canPrev: boolean;
  canNext: boolean;
  busy?: boolean;
  onPrev: () => void;
  onNext: () => void;
}

interface RunnerCardFooterProps extends RunnerCardNavProps {
  children?: ReactNode;
  mode?: "test" | "intro" | "complete";
}

export function RunnerCardFooter({
  canPrev,
  canNext,
  busy = false,
  onPrev,
  onNext,
  children,
  mode = "test",
}: RunnerCardFooterProps) {
  if (mode === "intro") {
    return (
      <footer className="test-card__footer test-card__footer--bookend test-card__footer--intro">
        <div className="test-card__footer-actions test-card__footer-actions--center">
          <button
            type="button"
            className="btn btn--start"
            disabled={!canNext || busy}
            onClick={onNext}
          >
            はじめる
          </button>
        </div>
      </footer>
    );
  }

  if (mode === "complete") {
    return (
      <footer className="test-card__footer test-card__footer--bookend test-card__footer--complete">
        <button
          type="button"
          className="btn btn--back"
          disabled={!canPrev || busy}
          onClick={onPrev}
        >
          戻る
        </button>
      </footer>
    );
  }

  return (
    <footer className="test-card__footer">
      <button
        type="button"
        className="test-card__nav"
        disabled={!canPrev || busy}
        aria-label="前へ"
        onClick={onPrev}
      >
        <ChevronIcon direction="prev" />
      </button>

      <div className="test-card__footer-actions">
        {children ?? (
          <>
            <div className="btn btn--ok btn--footer-slot" aria-hidden="true" />
            <div className="btn btn--ng btn--footer-slot" aria-hidden="true" />
          </>
        )}
      </div>

      <button
        type="button"
        className="test-card__nav"
        disabled={!canNext || busy}
        aria-label="次へ"
        onClick={onNext}
      >
        <ChevronIcon direction="next" />
      </button>
    </footer>
  );
}

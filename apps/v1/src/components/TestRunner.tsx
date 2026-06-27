import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { resolveSessionTestTargets, type TestStatus } from "@qarows/shared";
import { RunnerCompleteCard } from "@/components/RunnerCompleteCard";
import { RunnerIntroCard } from "@/components/RunnerIntroCard";
import { TestCard } from "@/components/TestCard";
import { useApp } from "@/context/AppContext";
import {
  isRunnerNextKey,
  isRunnerPrevKey,
  isRunnerTypingTarget,
  matchRunnerStatusKey,
} from "@/lib/runner-keybindings";
import { resolveRunnerTestCases } from "@/lib/utils";

export function TestRunner() {
  const {
    definition,
    results,
    session,
    runnerFilters,
    runnerIndex,
    setRunnerIndex,
    updateResults,
    updateResultsBatch,
  } = useApp();

  const [slideIndex, setSlideIndex] = useState(0);
  const [memo, setMemo] = useState("");
  const [busy, setBusy] = useState(false);
  const didRestoreSlide = useRef(false);
  const skipFilterSlideReset = useRef(true);

  const targets = useMemo(() => {
    if (!definition || !results || !session) return [];
    return resolveRunnerTestCases(definition, session, runnerFilters, results.results);
  }, [definition, results, session, runnerFilters]);

  const maxSlide = targets.length + 1;
  const testSlideIndex = slideIndex >= 1 && slideIndex <= targets.length ? slideIndex - 1 : null;
  const current = testSlideIndex != null ? targets[testSlideIndex] : undefined;

  const envTargets = useMemo(() => {
    if (!current || !definition || !session) return null;
    return resolveSessionTestTargets(current, definition, session.selectedEnvironmentIds);
  }, [current, definition, session]);

  useEffect(() => {
    if (!didRestoreSlide.current) {
      didRestoreSlide.current = true;
      if (runnerIndex > 0) {
        setSlideIndex(Math.min(runnerIndex + 1, targets.length + 1));
      }
      return;
    }
    if (runnerIndex < 0) {
      setSlideIndex((prev) => (prev > targets.length ? prev : 0));
      return;
    }
    setSlideIndex(Math.min(runnerIndex + 1, targets.length + 1));
  }, [runnerIndex, targets.length]);

  useEffect(() => {
    setSlideIndex((prev) => Math.min(prev, targets.length + 1));
  }, [targets.length]);

  useEffect(() => {
    if (skipFilterSlideReset.current) {
      skipFilterSlideReset.current = false;
      return;
    }
    setSlideIndex(targets.length > 0 ? 1 : 0);
  }, [runnerFilters, targets.length]);

  useEffect(() => {
    if (targets.length > 0 && runnerIndex >= targets.length) {
      void setRunnerIndex(targets.length - 1);
    }
  }, [runnerIndex, setRunnerIndex, targets.length]);

  useEffect(() => {
    if (!current || !results || !envTargets) {
      setMemo("");
      return;
    }
    const byEnv = results.results[current.id] ?? {};
    const existing =
      envTargets.environmentIds.map((id) => byEnv[id]?.memo).find((m) => m != null && m !== "") ??
      "";
    setMemo(existing);
  }, [current, envTargets, results]);

  const goToSlide = useCallback(
    (slide: number) => {
      if (slide < 0 || slide > maxSlide) return;
      setSlideIndex(slide);
      if (slide >= 1 && slide <= targets.length) {
        void setRunnerIndex(slide - 1);
      } else {
        void setRunnerIndex(-1);
      }
    },
    [maxSlide, setRunnerIndex, targets.length],
  );

  const applyBatch = useCallback(
    async (status: TestStatus) => {
      if (!current || !envTargets || busy || testSlideIndex == null) return;
      setBusy(true);
      try {
        await updateResultsBatch(current.id, envTargets.environmentIds, {
          status,
          memo: memo.trim() || undefined,
        });
        if (testSlideIndex < targets.length - 1) {
          goToSlide(testSlideIndex + 2);
        } else {
          goToSlide(targets.length + 1);
        }
      } finally {
        setBusy(false);
      }
    },
    [
      busy,
      current,
      envTargets,
      goToSlide,
      memo,
      targets.length,
      testSlideIndex,
      updateResultsBatch,
    ],
  );

  const applySingle = useCallback(
    async (envId: string, status: TestStatus) => {
      if (!current || !session || !envTargets || !results || busy || testSlideIndex == null) return;
      setBusy(true);
      try {
        const existing = results.results[current.id]?.[envId];
        await updateResults(current.id, envId, {
          status,
          memo: memo.trim() || existing?.memo,
          executedAt: new Date().toISOString(),
          executedBy: session.executorName,
        });

        const nextByEnv = {
          ...(results.results[current.id] ?? {}),
          [envId]: { status, memo: memo.trim() || existing?.memo },
        };
        const isComplete =
          envTargets.required === "any"
            ? envTargets.environmentIds.some((id) => nextByEnv[id]?.status)
            : envTargets.environmentIds.every((id) => nextByEnv[id]?.status);

        if (isComplete) {
          if (testSlideIndex < targets.length - 1) {
            goToSlide(testSlideIndex + 2);
          } else {
            goToSlide(targets.length + 1);
          }
        }
      } finally {
        setBusy(false);
      }
    },
    [
      busy,
      current,
      envTargets,
      goToSlide,
      memo,
      results,
      session,
      targets.length,
      testSlideIndex,
      updateResults,
    ],
  );

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (busy) return;
      if (isRunnerTypingTarget(e.target)) return;
      if (e.metaKey || e.ctrlKey || e.altKey) return;

      if (isRunnerPrevKey(e.key)) {
        if (slideIndex > 0) {
          e.preventDefault();
          goToSlide(slideIndex - 1);
        }
        return;
      }
      if (isRunnerNextKey(e.key)) {
        if (slideIndex < maxSlide) {
          e.preventDefault();
          goToSlide(slideIndex + 1);
        }
        return;
      }

      if (testSlideIndex == null) return;

      const status = matchRunnerStatusKey(e.key);
      if (status) {
        e.preventDefault();
        void applyBatch(status);
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [applyBatch, busy, goToSlide, maxSlide, slideIndex, testSlideIndex]);

  if (!definition || !results || !session) return null;

  return (
    <div className="w-full">
      <div className="flex w-full justify-center">
        <div className="w-full min-h-[80vh] max-w-2xl">
          {slideIndex === 0 && (
            <RunnerIntroCard
              canPrev={slideIndex > 0}
              canNext={slideIndex < maxSlide}
              busy={busy}
              onPrev={() => goToSlide(slideIndex - 1)}
              onNext={() => goToSlide(slideIndex + 1)}
            />
          )}
          {slideIndex === maxSlide && (
            <RunnerCompleteCard
              testCount={targets.length}
              canPrev={slideIndex > 0}
              canNext={slideIndex < maxSlide}
              busy={busy}
              onPrev={() => goToSlide(slideIndex - 1)}
              onNext={() => goToSlide(slideIndex + 1)}
            />
          )}
          {current && envTargets && (
            <TestCard
              testCase={current}
              definition={definition}
              results={results.results}
              envTargets={envTargets}
              memo={memo}
              busy={busy}
              canPrev={slideIndex > 0}
              canNext={slideIndex < maxSlide}
              onPrev={() => goToSlide(slideIndex - 1)}
              onNext={() => goToSlide(slideIndex + 1)}
              onMemoChange={setMemo}
              onBatch={(status) => void applyBatch(status)}
              onSingle={(envId, status) => void applySingle(envId, status)}
            />
          )}
        </div>
      </div>
    </div>
  );
}

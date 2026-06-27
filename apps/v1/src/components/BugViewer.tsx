import { useCallback, useEffect, useMemo } from "react";
import { useApp } from "@/context/AppContext";
import { BugCard } from "@/components/BugCard";
import { RunnerCardTransition } from "@/components/RunnerCardTransition";
import { useRunnerQueryState } from "@/hooks/useRunnerQueryState";
import { resolveFilteredBugs } from "@/lib/bug-filter";
import { getAllEnvironmentIds } from "@/lib/run-progress";
import { isRunnerNextKey, isRunnerPrevKey, isRunnerTypingTarget } from "@/lib/runner-keybindings";
import { testCardShellClass } from "@/components/RunnerCardFooter";

function BugEmptyCard() {
  return (
    <article className={testCardShellClass()}>
      <div className="flex min-h-0 flex-1 flex-col items-center justify-center px-4 py-10 text-center">
        <p className="text-base font-semibold text-foreground">表示するバグがありません</p>
        <p className="mt-2 max-w-sm text-sm text-muted-foreground">
          フィルタ条件に一致するバグがないか、まだバグが起票されていません。左の一覧から選択するか、フィルタを変更してください。
        </p>
      </div>
    </article>
  );
}

export function BugViewer() {
  const { definition, results, session } = useApp();
  const { runnerFilters, filtersSettled, bugId, setBugId, bugFilters } = useRunnerQueryState();

  const allEnvIds = useMemo(
    () => (definition ? getAllEnvironmentIds(definition) : []),
    [definition],
  );

  const targets = useMemo(() => {
    if (!definition || !results) return [];
    return resolveFilteredBugs(
      definition,
      runnerFilters,
      results.bugs,
      results.results,
      allEnvIds,
      session,
      bugFilters,
    );
  }, [allEnvIds, bugFilters, definition, results, runnerFilters, session]);

  const bugIndex = useMemo(() => {
    if (!bugId) return -1;
    const index = targets.findIndex((bug) => bug.id === bugId);
    return index >= 0 ? index : -1;
  }, [targets, bugId]);

  const current = bugIndex >= 0 ? targets[bugIndex] : undefined;

  const relatedTestCase = useMemo(() => {
    if (!current?.testCaseId || !definition) return undefined;
    return definition.testCases.find((testCase) => testCase.id === current.testCaseId);
  }, [current?.testCaseId, definition]);

  useEffect(() => {
    if (!filtersSettled) return;
    if (targets.length === 0) {
      if (bugId) void setBugId(null);
      return;
    }
    if (!bugId) return;

    const index = targets.findIndex((bug) => bug.id === bugId);
    if (index < 0) void setBugId(null);
  }, [bugId, filtersSettled, setBugId, targets]);

  const goToIndex = useCallback(
    (index: number) => {
      const bug = targets[index];
      if (bug) void setBugId(bug.id);
    },
    [setBugId, targets],
  );

  const goPrev = useCallback(() => {
    if (bugIndex <= 0) return;
    goToIndex(bugIndex - 1);
  }, [bugIndex, goToIndex]);

  const goNext = useCallback(() => {
    if (bugIndex < 0 || bugIndex >= targets.length - 1) return;
    goToIndex(bugIndex + 1);
  }, [bugIndex, goToIndex, targets.length]);

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (isRunnerTypingTarget(e.target)) return;
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      if (isRunnerPrevKey(e.key)) {
        e.preventDefault();
        goPrev();
      } else if (isRunnerNextKey(e.key)) {
        e.preventDefault();
        goNext();
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [goNext, goPrev]);

  if (!definition || !results) return null;

  return (
    <div className="flex min-h-0 min-w-0 flex-1 flex-col">
      <RunnerCardTransition slideKey={current?.id ?? "empty"}>
        {current ? (
          <BugCard
            bug={current}
            definition={definition}
            relatedTestCase={relatedTestCase}
            canPrev={bugIndex > 0}
            canNext={bugIndex >= 0 && bugIndex < targets.length - 1}
            onPrev={goPrev}
            onNext={goNext}
          />
        ) : (
          <BugEmptyCard />
        )}
      </RunnerCardTransition>
    </div>
  );
}

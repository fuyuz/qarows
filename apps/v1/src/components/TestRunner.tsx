import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  isResultEntryValid,
  nextBugId,
  resolveSessionTestTargets,
  testCaseNeedsRetest,
  type Bug,
  type TestCase,
  type TestStatus,
} from "@qarows/shared";
import { BugDialog, bugDraftToBug, type BugDialogDraft } from "@/components/BugDialog";
import { RelatedBugsDialog } from "@/components/RelatedBugsDialog";
import { TestCaseEditDialog } from "@/components/TestCaseEditDialog";
import { RunnerCardTransition } from "@/components/RunnerCardTransition";
import { RunnerCompleteCard } from "@/components/RunnerCompleteCard";
import { RunnerIntroCard } from "@/components/RunnerIntroCard";
import { TestCard } from "@/components/TestCard";
import { useApp } from "@/context/AppContext";
import { useRunnerQueryState } from "@/hooks/useRunnerQueryState";
import {
  isRunnerBugKey,
  isRunnerNextKey,
  isRunnerPrevKey,
  isRunnerTypingTarget,
  matchRunnerStatusKey,
} from "@/lib/runner-keybindings";
import { resolveRunnerTestCases } from "@/lib/utils";
import { formatTestCaseMarkdown } from "@/lib/format-test-case-markdown";

const AUTO_ADVANCE_DELAY_MS = 500;

interface BugDialogOpenState {
  initialTestCaseLinked: boolean;
  initialEnvironmentIds: string[];
  fromNg: boolean;
}

export function TestRunner() {
  const {
    definition,
    results,
    session,
    updateResults,
    updateResultsBatch,
    updateResultsFile,
    updateTestCase,
    clearTestResult,
  } = useApp();
  const { runnerFilters, filtersSettled, testId, setTestId } = useRunnerQueryState();

  const [slideIndex, setSlideIndex] = useState(0);
  const [memo, setMemo] = useState("");
  const [busy, setBusy] = useState(false);
  const [bugDialogOpen, setBugDialogOpen] = useState(false);
  const [bugDialogState, setBugDialogState] = useState<BugDialogOpenState | null>(null);
  const [bugCreateMore, setBugCreateMore] = useState(false);
  const [bugFormKey, setBugFormKey] = useState(0);
  const [relatedBugsDialogOpen, setRelatedBugsDialogOpen] = useState(false);
  const [testCaseEditDialogOpen, setTestCaseEditDialogOpen] = useState(false);
  const mountedRef = useRef(true);
  const advanceDelayRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pendingAdvanceSlideRef = useRef<number | null>(null);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      if (advanceDelayRef.current) clearTimeout(advanceDelayRef.current);
    };
  }, []);

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

  const relatedBugs = useMemo(() => {
    if (!results || !current) return [];
    return results.bugs.filter((bug) => bug.testCaseId === current.id);
  }, [results, current]);

  useEffect(() => {
    setRelatedBugsDialogOpen(false);
    setTestCaseEditDialogOpen(false);
  }, [current?.id]);

  useEffect(() => {
    if (!filtersSettled || targets.length === 0) return;

    if (!testId) {
      setSlideIndex((prev) => (prev === maxSlide ? prev : 0));
      setRelatedBugsDialogOpen(false);
      setBugDialogOpen(false);
      setBugDialogState(null);
      return;
    }

    const index = targets.findIndex((tc) => tc.id === testId);
    if (index >= 0) {
      setSlideIndex(index + 1);
      return;
    }

    void setTestId(null);
  }, [filtersSettled, maxSlide, setTestId, targets, testId]);

  useEffect(() => {
    if (!current || !results || !envTargets) {
      setMemo("");
      return;
    }
    const byEnv = results.results[current.id] ?? {};
    const existing =
      envTargets.environmentIds
        .map((id) => {
          const entry = byEnv[id];
          return isResultEntryValid(entry, current) ? entry?.memo : undefined;
        })
        .find((m) => m != null && m !== "") ?? "";
    setMemo(existing);
  }, [current, envTargets, results]);

  const needsRetest = useMemo(() => {
    if (!current || !results || !session || !definition) return false;
    return testCaseNeedsRetest(
      current,
      definition,
      session.selectedEnvironmentIds,
      results.results,
    );
  }, [current, definition, results, session]);

  const cancelPendingAdvance = useCallback(() => {
    if (advanceDelayRef.current) {
      clearTimeout(advanceDelayRef.current);
      advanceDelayRef.current = null;
    }
  }, []);

  const goToSlide = useCallback(
    (slide: number) => {
      if (slide < 0 || slide > maxSlide) return;
      cancelPendingAdvance();
      setSlideIndex(slide);
      if (slide >= 1 && slide <= targets.length) {
        void setTestId(targets[slide - 1].id);
      } else {
        void setTestId(null);
      }
    },
    [maxSlide, cancelPendingAdvance, setTestId, targets],
  );

  const waitBeforeAutoAdvance = useCallback(
    () =>
      new Promise<void>((resolve) => {
        cancelPendingAdvance();
        advanceDelayRef.current = setTimeout(() => {
          advanceDelayRef.current = null;
          resolve();
        }, AUTO_ADVANCE_DELAY_MS);
      }),
    [cancelPendingAdvance],
  );

  const advanceAfterComplete = useCallback(
    async (nextSlide: number) => {
      await waitBeforeAutoAdvance();
      if (!mountedRef.current) return;
      goToSlide(nextSlide);
    },
    [goToSlide, waitBeforeAutoAdvance],
  );

  const closeBugDialog = useCallback(
    (cancelled: boolean) => {
      const fromNg = bugDialogState?.fromNg ?? false;
      setBugDialogOpen(false);
      setBugDialogState(null);
      if (cancelled) setBugCreateMore(false);

      if (fromNg && pendingAdvanceSlideRef.current != null) {
        const nextSlide = pendingAdvanceSlideRef.current;
        pendingAdvanceSlideRef.current = null;
        void advanceAfterComplete(nextSlide);
      }
    },
    [advanceAfterComplete, bugDialogState],
  );

  const openBugDialog = useCallback(
    (state: BugDialogOpenState) => {
      setBugDialogState(state);
      setBugDialogOpen(true);
    },
    [],
  );

  const openManualBugDialog = useCallback(() => {
    pendingAdvanceSlideRef.current = null;
    openBugDialog({
      initialTestCaseLinked: true,
      initialEnvironmentIds: [],
      fromNg: false,
    });
  }, [openBugDialog]);

  const maybeDeferAdvanceForNg = useCallback(
    (nextSlide: number) => {
      pendingAdvanceSlideRef.current = nextSlide;
      openBugDialog({
        initialTestCaseLinked: true,
        initialEnvironmentIds: envTargets?.environmentIds ?? [],
        fromNg: true,
      });
    },
    [envTargets, openBugDialog],
  );

  const applyBatch = useCallback(
    async (status: TestStatus) => {
      if (!current || !envTargets || busy || testSlideIndex == null) return;
      cancelPendingAdvance();
      setBusy(true);
      try {
        await updateResultsBatch(current.id, envTargets.environmentIds, {
          status,
          memo: memo.trim() || undefined,
        });
      } finally {
        setBusy(false);
      }
      const nextSlide =
        testSlideIndex < targets.length - 1 ? testSlideIndex + 2 : targets.length + 1;

      if (status === "NG") {
        maybeDeferAdvanceForNg(nextSlide);
        return;
      }
      void advanceAfterComplete(nextSlide);
    },
    [
      busy,
      cancelPendingAdvance,
      current,
      envTargets,
      memo,
      advanceAfterComplete,
      maybeDeferAdvanceForNg,
      targets.length,
      testSlideIndex,
      updateResultsBatch,
    ],
  );

  const applySingle = useCallback(
    async (envId: string, status: TestStatus) => {
      if (!current || !session || !envTargets || !results || busy || testSlideIndex == null) return;
      cancelPendingAdvance();
      setBusy(true);
      try {
        const existing = results.results[current.id]?.[envId];
        const validExisting = isResultEntryValid(existing, current) ? existing : undefined;
        await updateResults(current.id, envId, {
          status,
          memo: memo.trim() || validExisting?.memo,
          executedAt: new Date().toISOString(),
          executedBy: session.executorName,
        });

        const nextByEnv = {
          ...(results.results[current.id] ?? {}),
          [envId]: { status, memo: memo.trim() || validExisting?.memo },
        };
        const isComplete =
          envTargets.required === "any"
            ? envTargets.environmentIds.some((id) => isResultEntryValid(nextByEnv[id], current))
            : envTargets.environmentIds.every((id) => isResultEntryValid(nextByEnv[id], current));

        if (isComplete) {
          const nextSlide =
            testSlideIndex < targets.length - 1 ? testSlideIndex + 2 : targets.length + 1;

          if (status === "NG") {
            pendingAdvanceSlideRef.current = nextSlide;
            openBugDialog({
              initialTestCaseLinked: true,
              initialEnvironmentIds: [envId],
              fromNg: true,
            });
            return;
          }
          void advanceAfterComplete(nextSlide);
        }
      } finally {
        setBusy(false);
      }
    },
    [
      busy,
      cancelPendingAdvance,
      current,
      envTargets,
      advanceAfterComplete,
      memo,
      openBugDialog,
      results,
      session,
      targets.length,
      testSlideIndex,
      updateResults,
    ],
  );

  const applyClear = useCallback(
    async (envId: string) => {
      if (!current || busy || testSlideIndex == null) return;
      setBusy(true);
      try {
        await clearTestResult(current.id, envId);
      } finally {
        setBusy(false);
      }
    },
    [busy, clearTestResult, current, testSlideIndex],
  );

  const handleBugSubmit = useCallback(
    async (draft: BugDialogDraft) => {
      if (!results) return;
      setBusy(true);
      try {
        const bug = bugDraftToBug(nextBugId(results.bugs), draft);
        await updateResultsFile((prev) => ({
          ...prev,
          bugs: [...prev.bugs, bug],
        }));

        if (bugCreateMore) {
          setBugFormKey((key) => key + 1);
          return;
        }
        closeBugDialog(false);
      } finally {
        setBusy(false);
      }
    },
    [bugCreateMore, closeBugDialog, results, updateResultsFile],
  );

  const handleRelatedBugSave = useCallback(
    async (bug: Bug) => {
      setBusy(true);
      try {
        await updateResultsFile((prev) => ({
          ...prev,
          bugs: prev.bugs.map((entry) => (entry.id === bug.id ? bug : entry)),
        }));
      } finally {
        setBusy(false);
      }
    },
    [updateResultsFile],
  );

  const handleTestCaseSave = useCallback(
    async (patch: Partial<Pick<TestCase, "category" | "prerequisites" | "description" | "version">>) => {
      if (!current) return;
      setBusy(true);
      try {
        await updateTestCase(current.id, patch);
      } finally {
        setBusy(false);
      }
    },
    [current, updateTestCase],
  );

  const handleCopyTestCase = useCallback(async () => {
    if (!definition || !current || !envTargets) return;
    const markdown = formatTestCaseMarkdown({
      definition,
      testCase: current,
      envTargets,
      bugs: relatedBugs,
    });
    await navigator.clipboard.writeText(markdown);
  }, [current, definition, envTargets, relatedBugs]);

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (busy || bugDialogOpen || relatedBugsDialogOpen || testCaseEditDialogOpen) return;
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

      if (isRunnerBugKey(e.key)) {
        e.preventDefault();
        openManualBugDialog();
        return;
      }

      const status = matchRunnerStatusKey(e.key);
      if (status) {
        e.preventDefault();
        void applyBatch(status);
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [
    applyBatch,
    bugDialogOpen,
    relatedBugsDialogOpen,
    testCaseEditDialogOpen,
    busy,
    goToSlide,
    maxSlide,
    openManualBugDialog,
    slideIndex,
    testSlideIndex,
  ]);

  if (!definition || !results || !session) return null;

  return (
    <div className="flex h-full min-h-0 w-full flex-col">
      <div className="flex min-h-0 flex-1 justify-center">
        <div className="h-full w-full min-h-0 max-w-2xl">
          <RunnerCardTransition slideKey={slideIndex}>
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
                onClear={(envId) => void applyClear(envId)}
                onOpenBug={openManualBugDialog}
                relatedBugCount={relatedBugs.length}
                onViewRelatedBugs={() => setRelatedBugsDialogOpen(true)}
                needsRetest={needsRetest}
                onEditTestCase={() => setTestCaseEditDialogOpen(true)}
                onCopyTestCase={handleCopyTestCase}
              />
            )}
          </RunnerCardTransition>
        </div>
      </div>

      {current && envTargets && bugDialogState && (
        <BugDialog
          open={bugDialogOpen}
          testCase={current}
          environments={definition.environments}
          availableEnvironmentIds={envTargets.environmentIds}
          initialTestCaseLinked={bugDialogState.initialTestCaseLinked}
          initialEnvironmentIds={bugDialogState.initialEnvironmentIds}
          createMore={bugCreateMore}
          formKey={bugFormKey}
          defaultAssignee={session.executorName}
          busy={busy}
          onCreateMoreChange={setBugCreateMore}
          onSubmit={handleBugSubmit}
          onCancel={() => closeBugDialog(true)}
        />
      )}

      {current && envTargets && relatedBugsDialogOpen && relatedBugs.length > 0 && (
        <RelatedBugsDialog
          open={relatedBugsDialogOpen}
          bugs={relatedBugs}
          testCase={current}
          environments={definition.environments}
          availableEnvironmentIds={envTargets.environmentIds}
          busy={busy}
          onSave={handleRelatedBugSave}
          onClose={() => setRelatedBugsDialogOpen(false)}
        />
      )}

      {current && envTargets && (
        <TestCaseEditDialog
          open={testCaseEditDialogOpen}
          testCase={current}
          envTargets={envTargets}
          busy={busy}
          onSave={handleTestCaseSave}
          onClose={() => setTestCaseEditDialogOpen(false)}
        />
      )}
    </div>
  );
}

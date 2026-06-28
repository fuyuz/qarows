import { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import type { Bug, BugStatus } from "@qarows/shared";
import { getNextBugStatus, isValidSession } from "@qarows/shared";
import { useRunnerWorkspace } from "../context/runner-workspace";
import { useProjectRoutes } from "../hooks/useProjectRoutes";
import { BugCard } from "./BugCard";
import { BugEditDialog } from "./BugEditDialog";
import { BugFixNoteDialog } from "./BugFixNoteDialog";
import { RunnerCardTransition } from "./RunnerCardTransition";
import { useRunnerQueryState } from "../hooks/useRunnerQueryState";
import { resolveFilteredBugs } from "../lib/bug-filter";
import { canJumpToRunner } from "../lib/jump-to-runner";
import { getAllEnvironmentIds } from "../lib/run-progress";
import { isRunnerNextKey, isRunnerPrevKey, isRunnerTypingTarget } from "../lib/runner-keybindings";
import { testCardShellClass } from "./RunnerCardFooter";

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
  const navigate = useNavigate();
  const { path } = useProjectRoutes();
  const { definition, results, session, updateBug } = useRunnerWorkspace();
  const { runnerFilters, filtersSettled, bugId, setBugId, bugFilters } = useRunnerQueryState();
  const [busy, setBusy] = useState(false);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [fixNoteDialog, setFixNoteDialog] = useState<{ bugId: string; initialNote: string } | null>(
    null,
  );

  const allEnvIds = useMemo(
    () => (definition ? getAllEnvironmentIds(definition) : []),
    [definition],
  );

  const availableEnvironmentIds = useMemo(() => {
    if (session && isValidSession(session)) return session.selectedEnvironmentIds;
    return allEnvIds;
  }, [allEnvIds, session]);

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

  const canNavigateToTestCase =
    relatedTestCase != null &&
    definition != null &&
    canJumpToRunner(relatedTestCase.id, definition, session);

  const handleNavigateToTestCase = useCallback(() => {
    if (!relatedTestCase || !definition) return;
    if (!canJumpToRunner(relatedTestCase.id, definition, session)) return;
    navigate(path("run", runnerFilters, relatedTestCase.id));
  }, [definition, navigate, path, relatedTestCase, runnerFilters, session]);

  useEffect(() => {
    setEditDialogOpen(false);
    setFixNoteDialog(null);
  }, [current?.id]);

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

  const saveBug = useCallback(
    async (nextBug: Bug) => {
      setBusy(true);
      try {
        await updateBug(nextBug);
      } finally {
        setBusy(false);
      }
    },
    [updateBug],
  );

  const handleStatusChange = useCallback(
    (nextStatus: BugStatus) => {
      if (!current || busy) return;
      if (nextStatus === current.status) return;
      if (nextStatus === "fixed") {
        setFixNoteDialog({ bugId: current.id, initialNote: current.fixNote ?? "" });
        return;
      }
      void saveBug({ ...current, status: nextStatus });
    },
    [busy, current, saveBug],
  );

  const nextStatus = current ? getNextBugStatus(current.status) : null;

  const handleAdvanceStatus = useCallback(() => {
    if (nextStatus) handleStatusChange(nextStatus);
  }, [handleStatusChange, nextStatus]);

  const handleFixNoteConfirm = useCallback(
    async (fixNote: string) => {
      if (!results || !fixNoteDialog) return;
      const bug = results.bugs.find((entry) => entry.id === fixNoteDialog.bugId);
      if (!bug) {
        setFixNoteDialog(null);
        return;
      }
      const trimmed = fixNote.trim();
      await saveBug({
        ...bug,
        status: "fixed",
        fixNote: trimmed || undefined,
      });
      setFixNoteDialog(null);
    },
    [fixNoteDialog, results, saveBug],
  );

  const handleEditSave = useCallback(
    async (nextBug: Bug) => {
      await saveBug(nextBug);
      setEditDialogOpen(false);
    },
    [saveBug],
  );

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
      if (busy || editDialogOpen || fixNoteDialog) return;
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
  }, [busy, editDialogOpen, fixNoteDialog, goNext, goPrev]);

  if (!definition || !results) return null;

  return (
    <>
      <div className="flex min-h-0 min-w-0 flex-1 flex-col">
        <RunnerCardTransition slideKey={current?.id ?? "empty"}>
          {current ? (
            <BugCard
              bug={current}
              definition={definition}
              relatedTestCase={relatedTestCase}
              busy={busy}
              canPrev={bugIndex > 0}
              canNext={bugIndex >= 0 && bugIndex < targets.length - 1}
              onPrev={goPrev}
              onNext={goNext}
              onStatusChange={handleStatusChange}
              onAdvanceStatus={nextStatus ? handleAdvanceStatus : undefined}
              onEdit={() => setEditDialogOpen(true)}
              onNavigateToTestCase={
                canNavigateToTestCase ? handleNavigateToTestCase : undefined
              }
            />
          ) : (
            <BugEmptyCard />
          )}
        </RunnerCardTransition>
      </div>

      {current && (
        <BugEditDialog
          open={editDialogOpen}
          bug={current}
          definition={definition}
          availableEnvironmentIds={availableEnvironmentIds}
          busy={busy}
          onSave={handleEditSave}
          onClose={() => setEditDialogOpen(false)}
        />
      )}

      {fixNoteDialog && (
        <BugFixNoteDialog
          open
          bugId={fixNoteDialog.bugId}
          initialNote={fixNoteDialog.initialNote}
          busy={busy}
          onConfirm={handleFixNoteConfirm}
          onCancel={() => setFixNoteDialog(null)}
        />
      )}
    </>
  );
}

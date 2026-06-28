import type { Bug, Environment, TestCase } from "@qarows/shared";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { BugFormFields } from "./BugFormFields";
import {
  bugDraftToBug,
  bugToDraft,
  isBugDraftDirty,
  normalizeBugDialogDraft,
  type BugDialogDraft,
} from "./BugDialog";
import { Button } from "@qarows/ui";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@qarows/ui";
import { isRunnerTypingTarget } from "../lib/runner-keybindings";
import { useProjectRoutes } from "../hooks/useProjectRoutes";
import { cn } from "@qarows/ui";

function emptyRelatedBugDraft(): BugDialogDraft {
  return {
    environmentIds: [],
    title: "",
    severity: "medium",
    assignee: "",
    status: "open",
    steps: "",
    expected: "",
    actual: "",
    fixNote: "",
    memo: "",
  };
}

export function RelatedBugsDialog({
  open,
  bugs,
  testCase,
  environments,
  availableEnvironmentIds,
  busy = false,
  onSave,
  onClose,
}: {
  open: boolean;
  bugs: Bug[];
  testCase: TestCase;
  environments: Environment[];
  availableEnvironmentIds: string[];
  busy?: boolean;
  onSave: (bug: Bug) => void | Promise<void>;
  onClose: () => void;
}) {
  const [index, setIndex] = useState(0);
  const [draft, setDraft] = useState<BugDialogDraft>(() =>
    bugs[0] != null ? bugToDraft(bugs[0]) : emptyRelatedBugDraft(),
  );
  const [titleError, setTitleError] = useState(false);
  const wasOpenRef = useRef(false);
  const navigate = useNavigate();
  const { path } = useProjectRoutes();

  const currentBug = bugs[index];
  const hasMultiple = bugs.length > 1;
  const isDirty = useMemo(
    () => (currentBug ? isBugDraftDirty(currentBug, draft) : false),
    [currentBug, draft],
  );

  useEffect(() => {
    if (open && !wasOpenRef.current && bugs[0]) {
      setIndex(0);
      setDraft(bugToDraft(bugs[0]));
      setTitleError(false);
    }
    wasOpenRef.current = open;
  }, [open, bugs, testCase.id]);

  useEffect(() => {
    if (open && bugs.length === 0) onClose();
  }, [open, bugs.length, onClose]);

  useEffect(() => {
    if (!open || bugs.length === 0) return;
    if (index >= bugs.length) {
      const next = bugs.length - 1;
      setIndex(next);
      setDraft(bugToDraft(bugs[next]!));
      setTitleError(false);
    }
  }, [bugs, index, open]);

  const goPrev = useCallback(() => {
    if (!hasMultiple) return;
    setIndex((prev) => {
      const next = prev > 0 ? prev - 1 : bugs.length - 1;
      setDraft(bugToDraft(bugs[next]!));
      setTitleError(false);
      return next;
    });
  }, [bugs, hasMultiple]);

  const goNext = useCallback(() => {
    if (!hasMultiple) return;
    setIndex((prev) => {
      const next = prev < bugs.length - 1 ? prev + 1 : 0;
      setDraft(bugToDraft(bugs[next]!));
      setTitleError(false);
      return next;
    });
  }, [bugs, hasMultiple]);

  useEffect(() => {
    if (!open || !hasMultiple) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (isRunnerTypingTarget(e.target)) return;
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      if (e.key === "h") {
        e.preventDefault();
        goPrev();
      } else if (e.key === "l") {
        e.preventDefault();
        goNext();
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [goNext, goPrev, hasMultiple, open]);

  const handleSave = async () => {
    if (!currentBug) return;
    const normalized = normalizeBugDialogDraft(draft);
    if (!normalized.title) {
      setTitleError(true);
      return;
    }
    setTitleError(false);
    await onSave(bugDraftToBug(currentBug.id, normalized));
  };

  const openInBugView = useCallback(() => {
    if (!currentBug) return;
    onClose();
    navigate(path("bugs", undefined, null, currentBug.id));
  }, [currentBug, navigate, onClose, path]);

  if (!open || !currentBug) return null;

  return (
    <Dialog
      open={open}
      onOpenChange={(nextOpen) => {
        if (!nextOpen) onClose();
      }}
    >
      <DialogContent className="flex min-w-0 max-h-[min(90vh,720px)] flex-col gap-0 overflow-hidden p-0 sm:max-w-2xl" showCloseButton={false}>
        <DialogHeader className="shrink-0 border-b px-6 py-4">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <DialogTitle>関連するバグ</DialogTitle>
              <DialogDescription>
                {testCase.id} に紐づく起票済みバグ（{bugs.length} 件）
              </DialogDescription>
            </div>
            {hasMultiple && (
              <div className="flex shrink-0 items-center gap-1">
                <Button
                  type="button"
                  variant="outline"
                  size="icon"
                  className="size-8"
                  aria-label="前のバグ"
                  disabled={busy}
                  onClick={goPrev}
                >
                  <ChevronLeft className="size-4" />
                </Button>
                <span className="min-w-16 text-center text-xs font-semibold tabular-nums text-muted-foreground">
                  {index + 1} / {bugs.length}
                </span>
                <Button
                  type="button"
                  variant="outline"
                  size="icon"
                  className="size-8"
                  aria-label="次のバグ"
                  disabled={busy}
                  onClick={goNext}
                >
                  <ChevronRight className="size-4" />
                </Button>
              </div>
            )}
          </div>
          {hasMultiple && (
            <p className="text-xs text-muted-foreground">
              <kbd className="rounded border bg-muted px-1 py-0.5 font-sans text-[0.7rem]">h</kbd>
              {" / "}
              <kbd className="rounded border bg-muted px-1 py-0.5 font-sans text-[0.7rem]">l</kbd>
              {" で切り替え"}
            </p>
          )}
        </DialogHeader>

        <div className="min-h-0 min-w-0 flex-1 overflow-x-hidden overflow-y-auto px-6 py-4">
          <button
            type="button"
            className="mb-4 text-xs font-bold text-primary hover:underline"
            onClick={openInBugView}
          >
            {currentBug.id}
          </button>
          <BugFormFields
            idPrefix={`related-bug-${currentBug.id}`}
            testCase={testCase}
            environments={environments}
            availableEnvironmentIds={availableEnvironmentIds}
            draft={draft}
            setDraft={setDraft}
            titleError={titleError}
            setTitleError={setTitleError}
          />
        </div>

        <DialogFooter className="shrink-0 border-t px-6 py-4">
          <div className="flex w-full justify-end gap-2">
            <Button type="button" variant="outline" disabled={busy} onClick={onClose}>
              閉じる
            </Button>
            <Button
              type="button"
              disabled={busy || !isDirty}
              className={cn(busy && "opacity-70")}
              onClick={() => void handleSave()}
            >
              保存
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

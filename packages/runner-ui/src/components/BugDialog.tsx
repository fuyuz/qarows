import type {
  Bug,
  BugAttachment,
  BugSeverity,
  BugStatus,
  Environment,
  TestCase,
} from "@qarows/shared";
import { buildBugPrefillFromTestCase } from "@qarows/shared";
import { useEffect, useState } from "react";
import { useTranslation } from "@qarows/ui";
import { useRunnerWorkspace } from "../context/runner-workspace";
import { BugFormFields } from "./BugFormFields";
import { Button } from "@qarows/ui";
import { Checkbox } from "@qarows/ui";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@qarows/ui";
import { cn } from "@qarows/ui";

export interface BugDialogDraft {
  testCaseId?: string;
  environmentIds: string[];
  title: string;
  severity: BugSeverity;
  assignee: string;
  status: BugStatus;
  steps: string;
  expected: string;
  actual: string;
  fixNote: string;
  memo: string;
  attachments: BugAttachment[];
}

export interface BugDialogProps {
  open: boolean;
  testCase: TestCase;
  environments: Environment[];
  availableEnvironmentIds: string[];
  initialTestCaseLinked: boolean;
  initialEnvironmentIds: string[];
  createMore: boolean;
  formKey: number;
  defaultAssignee?: string;
  busy?: boolean;
  onCreateMoreChange: (value: boolean) => void;
  onSubmit: (draft: BugDialogDraft) => void | Promise<void>;
  onCancel: () => void;
}

function buildInitialDraft(
  testCase: TestCase,
  initialTestCaseLinked: boolean,
  initialEnvironmentIds: string[],
  defaultAssignee = "",
  prereqLabel = "Prereq:",
): BugDialogDraft {
  const prefill = buildBugPrefillFromTestCase(testCase, prereqLabel);
  return {
    testCaseId: initialTestCaseLinked ? testCase.id : undefined,
    environmentIds: [...initialEnvironmentIds],
    title: "",
    severity: "medium",
    assignee: defaultAssignee,
    status: "open",
    steps: prefill.steps,
    expected: prefill.expected,
    actual: "",
    fixNote: "",
    memo: "",
    attachments: [],
  };
}

export function bugToDraft(bug: Bug): BugDialogDraft {
  return {
    testCaseId: bug.testCaseId,
    environmentIds: bug.environmentIds ? [...bug.environmentIds] : [],
    title: bug.title,
    severity: bug.severity,
    assignee: bug.assignee ?? "",
    status: bug.status,
    steps: bug.steps ?? "",
    expected: bug.expected ?? "",
    actual: bug.actual ?? "",
    fixNote: bug.fixNote ?? "",
    memo: bug.memo ?? "",
    attachments: bug.attachments ? [...bug.attachments] : [],
  };
}

export function normalizeBugDialogDraft(draft: BugDialogDraft): BugDialogDraft {
  return {
    ...draft,
    title: draft.title.trim(),
    assignee: draft.assignee.trim(),
    steps: draft.steps.trim(),
    expected: draft.expected.trim(),
    actual: draft.actual.trim(),
    fixNote: draft.fixNote.trim(),
    memo: draft.memo.trim(),
  };
}

export function bugDraftToBug(id: string, draft: BugDialogDraft): Bug {
  const normalized = normalizeBugDialogDraft(draft);
  return {
    id,
    testCaseId: normalized.testCaseId,
    environmentIds: normalized.environmentIds.length > 0 ? normalized.environmentIds : undefined,
    title: normalized.title,
    severity: normalized.severity,
    assignee: normalized.assignee || undefined,
    status: normalized.status,
    steps: normalized.steps || undefined,
    expected: normalized.expected || undefined,
    actual: normalized.actual || undefined,
    fixNote: normalized.fixNote || undefined,
    memo: normalized.memo || undefined,
    attachments: normalized.attachments.length > 0 ? normalized.attachments : undefined,
  };
}

function sortedEnvKey(envIds?: string[]): string {
  return [...(envIds ?? [])].sort().join("\0");
}

export function isBugDraftDirty(bug: Bug, draft: BugDialogDraft): boolean {
  const saved = bugDraftToBug(bug.id, bugToDraft(bug));
  const next = bugDraftToBug(bug.id, draft);
  return (
    saved.testCaseId !== next.testCaseId ||
    saved.title !== next.title ||
    saved.severity !== next.severity ||
    saved.status !== next.status ||
    (saved.assignee ?? "") !== (next.assignee ?? "") ||
    (saved.steps ?? "") !== (next.steps ?? "") ||
    (saved.expected ?? "") !== (next.expected ?? "") ||
    (saved.actual ?? "") !== (next.actual ?? "") ||
    (saved.fixNote ?? "") !== (next.fixNote ?? "") ||
    (saved.memo ?? "") !== (next.memo ?? "") ||
    sortedEnvKey(saved.environmentIds) !== sortedEnvKey(next.environmentIds) ||
    (saved.attachments ?? []).map((a) => a.key).join("\0") !==
      (next.attachments ?? []).map((a) => a.key).join("\0")
  );
}

export function BugDialog({
  open,
  testCase,
  environments,
  availableEnvironmentIds,
  initialTestCaseLinked,
  initialEnvironmentIds,
  createMore,
  formKey,
  defaultAssignee = "",
  busy = false,
  onCreateMoreChange,
  onSubmit,
  onCancel,
}: BugDialogProps) {
  const { t } = useTranslation();
  const { attachments: attachmentsAdapter } = useRunnerWorkspace();
  const prereqLabel = t("runner.prereqShort");
  const [draft, setDraft] = useState(() =>
    buildInitialDraft(
      testCase,
      initialTestCaseLinked,
      initialEnvironmentIds,
      defaultAssignee,
      prereqLabel,
    ),
  );
  const [titleError, setTitleError] = useState(false);

  useEffect(() => {
    if (!open) return;
    setDraft(
      buildInitialDraft(
        testCase,
        initialTestCaseLinked,
        initialEnvironmentIds,
        defaultAssignee,
        prereqLabel,
      ),
    );
    setTitleError(false);
  }, [
    defaultAssignee,
    open,
    formKey,
    testCase,
    initialTestCaseLinked,
    initialEnvironmentIds,
    prereqLabel,
  ]);

  const handleSubmit = async () => {
    const normalized = normalizeBugDialogDraft(draft);
    if (!normalized.title) {
      setTitleError(true);
      return;
    }
    setTitleError(false);
    await onSubmit(normalized);
  };

  // 起票キャンセル時はアップロード済みの実体を削除（すべてこのダイアログで追加されたもの）
  const handleCancel = () => {
    if (attachmentsAdapter) {
      for (const attachment of draft.attachments) {
        void attachmentsAdapter.remove(attachment.key).catch(() => {});
      }
    }
    onCancel();
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(nextOpen) => {
        if (!nextOpen) handleCancel();
      }}
    >
      <DialogContent className="flex min-w-0 max-h-[min(90vh,720px)] flex-col gap-0 overflow-hidden p-0 sm:max-w-2xl" showCloseButton={false}>
        <DialogHeader className="shrink-0 border-b px-6 py-4">
          <DialogTitle>{t("bug.report")}</DialogTitle>
          <DialogDescription>
            {t("bug.reportWhileRunning", { id: testCase.id })}
          </DialogDescription>
        </DialogHeader>

        <div className="min-h-0 min-w-0 flex-1 overflow-x-hidden overflow-y-auto px-6 py-4">
          <BugFormFields
            idPrefix="bug-create"
            testCase={testCase}
            environments={environments}
            availableEnvironmentIds={availableEnvironmentIds}
            draft={draft}
            setDraft={setDraft}
            titleError={titleError}
            setTitleError={setTitleError}
          />
        </div>

        <DialogFooter className="shrink-0 border-t px-6 py-4 sm:justify-between">
          <label className="flex cursor-pointer items-center gap-2 text-sm">
            <Checkbox
              checked={createMore}
              onCheckedChange={(value) => onCreateMoreChange(value === true)}
            />
            <span>Create more</span>
          </label>
          <div className="flex gap-2">
            <Button type="button" variant="outline" disabled={busy} onClick={handleCancel}>
              {t("common.cancel")}
            </Button>
            <Button
              type="button"
              disabled={busy}
              className={cn(busy && "opacity-70")}
              onClick={() => void handleSubmit()}
            >
              {t("common.create")}
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

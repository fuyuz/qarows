import type { Bug, TestDefinition } from "@qarows/shared";
import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  bugDraftToBug,
  bugToDraft,
  isBugDraftDirty,
  normalizeBugDialogDraft,
  type BugDialogDraft,
} from "./BugDialog";
import { BugFormFields } from "./BugFormFields";
import { Button } from "@qarows/ui";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@qarows/ui";
import { useTranslation } from "@qarows/ui";
import { cn } from "@qarows/ui";
import { useRunnerWorkspace } from "../context/runner-workspace";
import { useProjectRoutes } from "../hooks/useProjectRoutes";

export function BugEditDialog({
  open,
  bug,
  definition,
  availableEnvironmentIds,
  busy = false,
  onSave,
  onClose,
}: {
  open: boolean;
  bug: Bug;
  definition: TestDefinition;
  availableEnvironmentIds: string[];
  busy?: boolean;
  onSave: (bug: Bug) => void | Promise<void>;
  onClose: () => void;
}) {
  const { t } = useTranslation();
  const { attachments: attachmentsAdapter } = useRunnerWorkspace();
  const [draft, setDraft] = useState<BugDialogDraft>(() => bugToDraft(bug));
  const [titleError, setTitleError] = useState(false);
  const navigate = useNavigate();
  const { path } = useProjectRoutes();

  const isDirty = useMemo(() => isBugDraftDirty(bug, draft), [bug, draft]);

  useEffect(() => {
    if (open) {
      setDraft(bugToDraft(bug));
      setTitleError(false);
    }
  }, [bug, open]);

  const savedKeys = useMemo(() => new Set((bug.attachments ?? []).map((a) => a.key)), [bug]);

  const handleSave = async () => {
    const normalized = normalizeBugDialogDraft(draft);
    if (!normalized.title) {
      setTitleError(true);
      return;
    }
    setTitleError(false);
    await onSave(bugDraftToBug(bug.id, normalized));
    // 保存成功後、外された既存添付の実体を削除する
    if (attachmentsAdapter) {
      const remaining = new Set(normalized.attachments.map((a) => a.key));
      for (const key of savedKeys) {
        if (!remaining.has(key)) void attachmentsAdapter.remove(key).catch(() => {});
      }
    }
  };

  // キャンセル時は、このダイアログで新規アップロードした実体だけを削除する
  const handleClose = () => {
    if (attachmentsAdapter) {
      for (const attachment of draft.attachments) {
        if (!savedKeys.has(attachment.key)) {
          void attachmentsAdapter.remove(attachment.key).catch(() => {});
        }
      }
    }
    onClose();
  };

  if (!open) return null;

  return (
    <Dialog
      open={open}
      onOpenChange={(nextOpen) => {
        if (!nextOpen) handleClose();
      }}
    >
      <DialogContent className="flex min-w-0 max-h-[min(90vh,720px)] flex-col gap-0 overflow-hidden p-0 sm:max-w-2xl" showCloseButton={false}>
        <DialogHeader className="shrink-0 border-b px-6 py-4">
          <DialogTitle>{t("bug.edit")}</DialogTitle>
          <DialogDescription>
            <button
              type="button"
              className="font-bold text-primary hover:underline"
              onClick={() => {
                handleClose();
                navigate(path("bugs", undefined, null, bug.id));
              }}
            >
              {bug.id}
            </button>
            {t("bug.editBodySuffix")}
          </DialogDescription>
        </DialogHeader>

        <div className="min-h-0 min-w-0 flex-1 overflow-x-hidden overflow-y-auto px-6 py-4">
          <BugFormFields
            idPrefix={`bug-edit-${bug.id}`}
            testCases={definition.testCases}
            environments={definition.environments}
            availableEnvironmentIds={availableEnvironmentIds}
            draft={draft}
            setDraft={setDraft}
            titleError={titleError}
            setTitleError={setTitleError}
          />
        </div>

        <DialogFooter className="shrink-0 border-t px-6 py-4">
          <div className="flex w-full justify-end gap-2">
            <Button type="button" variant="outline" disabled={busy} onClick={handleClose}>
              {t("common.cancel")}
            </Button>
            <Button
              type="button"
              disabled={busy || !isDirty}
              className={cn(busy && "opacity-70")}
              onClick={() => void handleSave()}
            >
              {t("common.save")}
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

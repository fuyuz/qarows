import type { Bug, TestDefinition } from "@qarows/shared";
import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  bugDraftToBug,
  bugToDraft,
  isBugDraftDirty,
  normalizeBugDialogDraft,
  type BugDialogDraft,
} from "@/components/BugDialog";
import { BugFormFields } from "@/components/BugFormFields";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { cn } from "@/lib/cn";
import { useProjectRoutes } from "@/hooks/useProjectRoutes";

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

  const handleSave = async () => {
    const normalized = normalizeBugDialogDraft(draft);
    if (!normalized.title) {
      setTitleError(true);
      return;
    }
    setTitleError(false);
    await onSave(bugDraftToBug(bug.id, normalized));
  };

  if (!open) return null;

  return (
    <Dialog
      open={open}
      onOpenChange={(nextOpen) => {
        if (!nextOpen) onClose();
      }}
    >
      <DialogContent className="flex min-w-0 max-h-[min(90vh,720px)] flex-col gap-0 overflow-hidden p-0 sm:max-w-2xl" showCloseButton={false}>
        <DialogHeader className="shrink-0 border-b px-6 py-4">
          <DialogTitle>バグを編集</DialogTitle>
          <DialogDescription>
            <button
              type="button"
              className="font-bold text-primary hover:underline"
              onClick={() => {
                onClose();
                navigate(path("bugs", undefined, null, bug.id));
              }}
            >
              {bug.id}
            </button>
            {" の内容を編集します。"}
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
            <Button type="button" variant="outline" disabled={busy} onClick={onClose}>
              キャンセル
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

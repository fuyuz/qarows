import { useEffect, useState } from "react";
import { useTranslation } from "@qarows/ui";
import { Button } from "@qarows/ui";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@qarows/ui";
import { Label } from "@qarows/ui";
import { Textarea } from "@qarows/ui";

export function BugFixNoteDialog({
  open,
  bugId,
  initialNote = "",
  busy = false,
  onConfirm,
  onCancel,
}: {
  open: boolean;
  bugId: string;
  initialNote?: string;
  busy?: boolean;
  onConfirm: (fixNote: string) => void | Promise<void>;
  onCancel: () => void;
}) {
  const { t } = useTranslation();
  const [note, setNote] = useState(initialNote);

  useEffect(() => {
    if (open) setNote(initialNote);
  }, [initialNote, open, bugId]);

  if (!open) return null;

  return (
    <Dialog
      open={open}
      onOpenChange={(nextOpen) => {
        if (!nextOpen) onCancel();
      }}
    >
      <DialogContent className="sm:max-w-lg" showCloseButton={false}>
        <DialogHeader>
          <DialogTitle>{t("bug.fixNoteTitle")}</DialogTitle>
          <DialogDescription>
            {t("bug.fixNoteBody", { id: bugId })}
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-2 py-1">
          <Label htmlFor="bug-fix-note">{t("bug.fixNote")}</Label>
          <Textarea
            id="bug-fix-note"
            rows={4}
            value={note}
            placeholder={t("bug.fixNotePlaceholder")}
            onChange={(e) => setNote(e.target.value)}
          />
        </div>

        <DialogFooter>
          <Button type="button" variant="outline" disabled={busy} onClick={onCancel}>
            {t("common.cancel")}
          </Button>
          <Button type="button" disabled={busy} onClick={() => void onConfirm(note)}>
            {t("bug.markFixed")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

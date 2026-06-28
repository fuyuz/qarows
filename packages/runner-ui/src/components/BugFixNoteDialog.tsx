import { useEffect, useState } from "react";
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
          <DialogTitle>修正内容</DialogTitle>
          <DialogDescription>
            {bugId} を修正済みにします。修正内容を記録できます（任意）。
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-2 py-1">
          <Label htmlFor="bug-fix-note">修正内容</Label>
          <Textarea
            id="bug-fix-note"
            rows={4}
            value={note}
            placeholder="例: ボタンの min-width を調整"
            onChange={(e) => setNote(e.target.value)}
          />
        </div>

        <DialogFooter>
          <Button type="button" variant="outline" disabled={busy} onClick={onCancel}>
            キャンセル
          </Button>
          <Button type="button" disabled={busy} onClick={() => void onConfirm(note)}>
            修正済みにする
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

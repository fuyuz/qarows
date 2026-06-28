import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "../ui/dialog";
import { Button } from "../ui/button";

export interface ProjectOverwriteDialogProps {
  open: boolean;
  projectName: string;
  projectId: string;
  loading?: boolean;
  onOpenChange: (open: boolean) => void;
  onConfirm: () => void;
  onCancel: () => void;
}

export function ProjectOverwriteDialog({
  open,
  projectName,
  projectId,
  loading = false,
  onOpenChange,
  onConfirm,
  onCancel,
}: ProjectOverwriteDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent showCloseButton={false}>
        <DialogHeader>
          <DialogTitle>既存プロジェクトを上書きしますか？</DialogTitle>
          <DialogDescription asChild>
            <div className="space-y-2 text-sm text-muted-foreground">
              <p>
                「{projectName}」（id: {projectId}）は既に登録されています。
              </p>
              <p>tests.yml を読み込むと、定義・結果・セッションがすべて置き換わります。</p>
            </div>
          </DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button variant="outline" onClick={onCancel}>
            キャンセル
          </Button>
          <Button variant="destructive" disabled={loading} onClick={onConfirm}>
            {loading ? "読み込み中…" : "上書きする"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

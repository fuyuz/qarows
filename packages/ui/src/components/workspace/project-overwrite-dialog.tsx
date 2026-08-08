import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "../ui/dialog";
import { Button } from "../ui/button";
import { useTranslation } from "../../i18n/context";

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
  const { t } = useTranslation();

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent showCloseButton={false}>
        <DialogHeader>
          <DialogTitle>{t("project.overwriteTitle")}</DialogTitle>
          <DialogDescription asChild>
            <div className="space-y-2 text-sm text-muted-foreground">
              <p>{t("project.overwriteBody", { name: projectName, id: projectId })}</p>
              <p>{t("project.overwriteWarning")}</p>
            </div>
          </DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button variant="outline" onClick={onCancel}>
            {t("common.cancel")}
          </Button>
          <Button variant="destructive" disabled={loading} onClick={onConfirm}>
            {loading ? t("common.loadingAction") : t("common.overwrite")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

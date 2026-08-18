import { useState } from "react";
import { classifyResultsFiles, FileDropZone } from "@/components/FileDropZone";
import {
  Alert,
  AlertDescription,
  Badge,
  Button,
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  Separator,
  cn,
  useTranslation,
} from "@qarows/ui";
import { appendUniqueFiles, fileKey } from "@/lib/utils";

function formatUpdatedAt(iso: string, localeTag: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return iso;
  return date.toLocaleString(localeTag, {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export interface ProjectDetailPanelProps {
  projectId: string;
  name: string;
  updatedAt: string;
  hasValidSession: boolean;
  isLastOpened: boolean;
  onContinue: () => void;
  onMerge: (files: File[]) => Promise<void>;
  onClearResults: () => Promise<void>;
  onExportYaml: () => Promise<void>;
  onExportResults: () => Promise<void>;
  onExportZip: () => Promise<void>;
  onDelete: () => Promise<void>;
}

export function ProjectDetailPanel({
  projectId,
  name,
  updatedAt,
  hasValidSession,
  isLastOpened,
  onContinue,
  onMerge,
  onClearResults,
  onExportYaml,
  onExportResults,
  onExportZip,
  onDelete,
}: ProjectDetailPanelProps) {
  const { t, localeTag } = useTranslation();
  const [mergeFiles, setMergeFiles] = useState<File[]>([]);
  const [merging, setMerging] = useState(false);
  const [clearDialogOpen, setClearDialogOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [clearing, setClearing] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  const appendMergeFiles = (files: File[]) => {
    const { results, unknown } = classifyResultsFiles(files);
    if (unknown.length > 0) {
      setError(t("error.unsupportedFiles", { files: unknown.map((f) => f.name).join(", ") }));
    } else {
      setError(null);
    }
    if (results.length === 0) return;
    setMergeFiles((prev) => appendUniqueFiles(prev, results));
    setSuccessMessage(null);
  };

  const handleMerge = async () => {
    if (mergeFiles.length === 0) return;
    setMerging(true);
    setError(null);
    setSuccessMessage(null);
    try {
      await onMerge(mergeFiles);
      const count = mergeFiles.length;
      setMergeFiles([]);
      setSuccessMessage(t("project.importedResults", { n: count }));
    } catch (err) {
      setError(err instanceof Error ? err.message : t("error.importResultsFailed"));
    } finally {
      setMerging(false);
    }
  };

  const handleClear = async () => {
    setClearing(true);
    setError(null);
    try {
      await onClearResults();
      setClearDialogOpen(false);
      setSuccessMessage(t("project.clearedResults"));
    } catch (err) {
      setError(err instanceof Error ? err.message : t("error.clearResultsFailed"));
    } finally {
      setClearing(false);
    }
  };

  const handleDelete = async () => {
    setDeleting(true);
    setError(null);
    try {
      await onDelete();
      setDeleteDialogOpen(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : t("error.deleteProjectFailed"));
    } finally {
      setDeleting(false);
    }
  };

  return (
    <>
      <Card className={cn("flex h-full min-h-0 flex-col overflow-hidden", isLastOpened && "border-primary/40")}>
        <CardHeader className="shrink-0 pb-3">
          <div className="flex flex-wrap items-start justify-between gap-2">
            <div className="min-w-0">
              <CardTitle className="text-lg">{name}</CardTitle>
              <CardDescription className="mt-1 font-mono text-xs">{projectId}</CardDescription>
            </div>
            <div className="flex flex-wrap gap-1.5">
              {hasValidSession && <Badge>{t("project.badgeSessionActive")}</Badge>}
              {isLastOpened && <Badge variant="secondary">{t("project.badgeLastOpened")}</Badge>}
            </div>
          </div>
          <p className="text-xs text-muted-foreground">
            {t("project.lastUpdated")} {formatUpdatedAt(updatedAt, localeTag)}
          </p>
        </CardHeader>
        <CardContent className="min-h-0 flex-1 overflow-y-auto">
          <div className="flex flex-col gap-4">
            <div className="flex flex-wrap gap-2">
              <Button onClick={onContinue}>{t("common.continue")}</Button>
              <Button variant="outline" onClick={() => void onExportYaml()}>
                tests.yml
              </Button>
              <Button variant="outline" onClick={() => void onExportResults()}>
                results.json
              </Button>
              <Button variant="outline" onClick={() => void onExportZip()}>
                zip
              </Button>
            </div>

            <Separator />

            <div>
              <p className="mb-2 text-sm font-medium">{t("project.mergeResults")}</p>
              <FileDropZone
                title={t("project.dropResults")}
                hint={t("project.dropResultsHint")}
                accept=".json,application/json"
                onFiles={appendMergeFiles}
              />
              {mergeFiles.length > 0 && (
                <ul className="mt-3 flex flex-col gap-1.5 text-sm">
                  {mergeFiles.map((file) => (
                    <li key={fileKey(file)} className="truncate text-muted-foreground">
                      {file.name}
                    </li>
                  ))}
                </ul>
              )}
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="mt-3"
                disabled={mergeFiles.length === 0 || merging}
                onClick={() => void handleMerge()}
              >
                {merging ? t("common.importing") : t("common.import")}
              </Button>
            </div>

            <div className="flex flex-wrap gap-2">
              <Button variant="destructive" size="sm" onClick={() => setClearDialogOpen(true)}>
                {t("project.clearResults")}
              </Button>
              <Button variant="destructive" size="sm" onClick={() => setDeleteDialogOpen(true)}>
                {t("common.delete")}
              </Button>
            </div>

            {successMessage && (
              <Alert className="border-emerald-200 bg-emerald-50 text-emerald-900">
                <AlertDescription>{successMessage}</AlertDescription>
              </Alert>
            )}
            {error && (
              <Alert variant="destructive">
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            )}
          </div>
        </CardContent>
      </Card>

      <Dialog open={clearDialogOpen} onOpenChange={setClearDialogOpen}>
        <DialogContent showCloseButton={false}>
          <DialogHeader>
            <DialogTitle>{t("project.clearResultsTitle")}</DialogTitle>
            <DialogDescription>{t("project.clearResultsBody", { name })}</DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setClearDialogOpen(false)}>
              {t("common.cancel")}
            </Button>
            <Button variant="destructive" disabled={clearing} onClick={() => void handleClear()}>
              {clearing ? t("common.clearing") : t("common.clear")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <DialogContent showCloseButton={false}>
          <DialogHeader>
            <DialogTitle>{t("project.deleteTitle")}</DialogTitle>
            <DialogDescription>
              {t("project.deleteBody", { name, id: projectId })}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteDialogOpen(false)}>
              {t("common.cancel")}
            </Button>
            <Button variant="destructive" disabled={deleting} onClick={() => void handleDelete()}>
              {deleting ? t("common.deleting") : t("common.delete")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

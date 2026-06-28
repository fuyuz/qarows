import { useEffect, useState } from "react";
import { isValidSession, serializeResultsJson, serializeTestsYaml } from "@qarows/shared";
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
  cn,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@qarows/ui";
import { getProject, type ProjectSnapshot } from "@/lib/api/projects";
import { downloadText } from "@/lib/file-utils";

function formatUpdatedAt(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return iso;
  return date.toLocaleString("ja-JP", {
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
  isLastOpened: boolean;
  onContinue: (hasValidSession: boolean) => void;
  onDelete: () => Promise<void>;
}

export function ProjectDetailPanel({
  projectId,
  name,
  updatedAt,
  isLastOpened,
  onContinue,
  onDelete,
}: ProjectDetailPanelProps) {
  const [snapshot, setSnapshot] = useState<ProjectSnapshot | null>(null);
  const [loadingSnapshot, setLoadingSnapshot] = useState(true);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setLoadingSnapshot(true);
    void getProject(projectId)
      .then((data) => {
        if (!cancelled) setSnapshot(data);
      })
      .catch((err: unknown) => {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : "プロジェクトの取得に失敗しました");
        }
      })
      .finally(() => {
        if (!cancelled) setLoadingSnapshot(false);
      });
    return () => {
      cancelled = true;
    };
  }, [projectId]);

  const hasValidSession =
    snapshot?.session != null && isValidSession(snapshot.session);

  const handleExportYaml = () => {
    if (!snapshot) return;
    downloadText(serializeTestsYaml(snapshot.definition), "tests.yml", "text/yaml");
  };

  const handleExportResults = () => {
    if (!snapshot) return;
    downloadText(serializeResultsJson(snapshot.results), "results.json", "application/json");
  };

  const handleDelete = async () => {
    setDeleting(true);
    setError(null);
    try {
      await onDelete();
      setDeleteDialogOpen(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : "プロジェクトの削除に失敗しました");
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
              {hasValidSession && <Badge>セッションあり</Badge>}
              {isLastOpened && <Badge variant="secondary">前回</Badge>}
            </div>
          </div>
          <p className="text-xs text-muted-foreground">最終更新: {formatUpdatedAt(updatedAt)}</p>
        </CardHeader>
        <CardContent className="min-h-0 flex-1 overflow-y-auto">
          <div className="flex flex-col gap-4">
            <div className="flex flex-wrap gap-2">
              <Button
                disabled={loadingSnapshot}
                onClick={() => onContinue(hasValidSession)}
              >
                続ける
              </Button>
              <Button
                variant="outline"
                disabled={!snapshot}
                onClick={handleExportYaml}
              >
                tests.yml
              </Button>
              <Button
                variant="outline"
                disabled={!snapshot}
                onClick={handleExportResults}
              >
                results.json
              </Button>
            </div>

            <p className="text-sm text-muted-foreground">
              Phase 2 では結果のマージはワークスペース内でリアルタイム同期されます。
            </p>

            <div className="flex flex-wrap gap-2">
              <Button variant="destructive" size="sm" onClick={() => setDeleteDialogOpen(true)}>
                削除
              </Button>
            </div>

            {error && (
              <Alert variant="destructive">
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            )}
          </div>
        </CardContent>
      </Card>

      <Dialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <DialogContent showCloseButton={false}>
          <DialogHeader>
            <DialogTitle>プロジェクトを削除しますか？</DialogTitle>
            <DialogDescription>
              「{name}」（id: {projectId}）の定義・結果・セッションをすべて削除します。元に戻せません。
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteDialogOpen(false)}>
              キャンセル
            </Button>
            <Button variant="destructive" disabled={deleting} onClick={() => void handleDelete()}>
              {deleting ? "削除中…" : "削除"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

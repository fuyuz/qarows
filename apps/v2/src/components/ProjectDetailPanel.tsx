import { useCallback, useEffect, useRef, useState } from "react";
import { serializeResultsJson, serializeTestsYaml } from "@qarows/shared";
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
  classifyResultsFiles,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  FileDropZone,
  Separator,
} from "@qarows/ui";
import { getProject, type ProjectSnapshot } from "@/lib/api/projects";
import { appendUniqueFiles, downloadText, fileKey } from "@/lib/file-utils";

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
  hasValidSession: boolean;
  isLastOpened: boolean;
  onContinue: () => void;
  onMerge: (files: File[], expectedGeneration: string) => Promise<void>;
  onClearResults: () => Promise<void>;
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
  onDelete,
}: ProjectDetailPanelProps) {
  const [snapshot, setSnapshot] = useState<ProjectSnapshot | null>(null);
  const [loadingSnapshot, setLoadingSnapshot] = useState(true);
  const [mergeFiles, setMergeFiles] = useState<File[]>([]);
  const [merging, setMerging] = useState(false);
  const [clearDialogOpen, setClearDialogOpen] = useState(false);
  const [clearing, setClearing] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const projectIdRef = useRef(projectId);
  projectIdRef.current = projectId;

  const snapshotReady = snapshot != null && snapshot.id === projectId && !loadingSnapshot;

  const loadSnapshot = useCallback(async (targetProjectId: string) => {
    setLoadingSnapshot(true);
    setError(null);
    try {
      const data = await getProject(targetProjectId);
      if (projectIdRef.current !== targetProjectId) return;
      setSnapshot(data);
    } catch (err: unknown) {
      if (projectIdRef.current !== targetProjectId) return;
      setError(err instanceof Error ? err.message : "プロジェクトの取得に失敗しました");
    } finally {
      if (projectIdRef.current === targetProjectId) {
        setLoadingSnapshot(false);
      }
    }
  }, []);

  useEffect(() => {
    setSuccessMessage(null);
    setMergeFiles([]);
    void loadSnapshot(projectId);
  }, [projectId, loadSnapshot]);

  const handleExportYaml = () => {
    if (!snapshotReady) return;
    downloadText(serializeTestsYaml(snapshot!.definition), "tests.yml", "text/yaml");
  };

  const handleExportResults = () => {
    if (!snapshotReady) return;
    downloadText(serializeResultsJson(snapshot!.results), "results.json", "application/json");
  };

  const appendMergeFiles = (files: File[]) => {
    const { results, unknown } = classifyResultsFiles(files);
    if (unknown.length > 0) {
      setError(`未対応のファイル: ${unknown.map((f) => f.name).join(", ")}`);
    } else {
      setError(null);
    }
    if (results.length === 0) return;
    setMergeFiles((prev) => appendUniqueFiles(prev, results));
    setSuccessMessage(null);
  };

  const handleMerge = async () => {
    if (mergeFiles.length === 0 || !snapshot?.generation) return;
    setMerging(true);
    setError(null);
    setSuccessMessage(null);
    try {
      await onMerge(mergeFiles, snapshot.generation);
      const count = mergeFiles.length;
      setMergeFiles([]);
      setSuccessMessage(`${count} 件の results.json を取り込みました`);
      await loadSnapshot(projectId);
    } catch (err) {
      setError(err instanceof Error ? err.message : "results.json の取り込みに失敗しました");
    } finally {
      setMerging(false);
    }
  };

  const handleClear = async () => {
    setClearing(true);
    setError(null);
    setSuccessMessage(null);
    try {
      await onClearResults();
      setClearDialogOpen(false);
      setSuccessMessage("テスト結果をクリアしました");
      await loadSnapshot(projectId);
    } catch (err) {
      setError(err instanceof Error ? err.message : "テスト結果のクリアに失敗しました");
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
              <Button onClick={onContinue}>続ける</Button>
              <Button
                variant="outline"
                disabled={!snapshotReady}
                aria-busy={loadingSnapshot}
                onClick={handleExportYaml}
              >
                tests.yml
              </Button>
              <Button
                variant="outline"
                disabled={!snapshotReady}
                aria-busy={loadingSnapshot}
                onClick={handleExportResults}
              >
                results.json
              </Button>
            </div>

            <Separator />

            <div>
              <p className="mb-2 text-sm font-medium">results.json をマージ</p>
              <FileDropZone
                title="results.json をここにドロップ"
                hint="複数ファイル可"
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
                {merging ? "取り込み中…" : "取り込む"}
              </Button>
            </div>

            <div className="flex flex-wrap gap-2">
              <Button variant="destructive" size="sm" onClick={() => setClearDialogOpen(true)}>
                結果をクリア
              </Button>
              <Button variant="destructive" size="sm" onClick={() => setDeleteDialogOpen(true)}>
                削除
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
            <DialogTitle>テスト結果をクリアしますか？</DialogTitle>
            <DialogDescription>
              「{name}」の実行結果、バグ、セッション設定を削除します。tests.yml の定義は残ります。
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setClearDialogOpen(false)}>
              キャンセル
            </Button>
            <Button variant="destructive" disabled={clearing} onClick={() => void handleClear()}>
              {clearing ? "クリア中…" : "クリア"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

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

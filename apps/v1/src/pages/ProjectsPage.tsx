import { useCallback, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  serializeResultsJson,
  serializeTestsYaml,
} from "@qarows/shared";
import { classifyResultsFiles, FileDropZone } from "@/components/FileDropZone";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Separator } from "@/components/ui/separator";
import { useApp } from "@/context/AppContext";
import { getProject } from "@/lib/storage";
import { projectPath } from "@/lib/project-routes";
import { readFileAsText, downloadText, appendUniqueFiles, fileKey } from "@/lib/utils";
import { cn } from "@/lib/cn";

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

interface ProjectCardProps {
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
  onDelete: () => Promise<void>;
}

function ProjectCard({
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
  onDelete,
}: ProjectCardProps) {
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
      setError(`未対応のファイル: ${unknown.map((f) => f.name).join(", ")}`);
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
      setSuccessMessage(`${count} 件の results.json を取り込みました`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "results.json の取り込みに失敗しました");
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
      setSuccessMessage("テスト結果をクリアしました");
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
    <Card className={cn(isLastOpened && "border-primary/40")}>
      <CardHeader className="pb-3">
        <div className="flex flex-wrap items-start justify-between gap-2">
          <div className="min-w-0">
            <CardTitle className="text-lg">{name}</CardTitle>
            <CardDescription className="mt-1 font-mono text-xs">{projectId}</CardDescription>
          </div>
          <div className="flex flex-wrap gap-1.5">
            {isLastOpened && <Badge variant="secondary">前回</Badge>}
            {hasValidSession && <Badge>セッションあり</Badge>}
          </div>
        </div>
        <p className="text-xs text-muted-foreground">最終更新: {formatUpdatedAt(updatedAt)}</p>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        <div className="flex flex-wrap gap-2">
          <Button onClick={onContinue}>続ける</Button>
          <Button variant="outline" onClick={() => void onExportYaml()}>
            tests.yml
          </Button>
          <Button variant="outline" onClick={() => void onExportResults()}>
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
      </CardContent>

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
    </Card>
  );
}

export function ProjectsPage() {
  const navigate = useNavigate();
  const {
    ready,
    projectSummaries,
    lastOpenedProjectId,
    activateProject,
    mergeResultsIntoProject,
    clearResultsForProject,
    deleteProject,
    refreshProjectSummaries,
  } = useApp();

  const handleContinue = useCallback(
    async (projectId: string, hasValidSession: boolean) => {
      await activateProject(projectId);
      navigate(projectPath(projectId, hasValidSession ? "run" : "session"));
    },
    [activateProject, navigate],
  );

  const handleMerge = useCallback(
    async (projectId: string, files: File[]) => {
      const jsons = await Promise.all(files.map((file) => readFileAsText(file)));
      const ok = await mergeResultsIntoProject(projectId, jsons);
      if (!ok) {
        await refreshProjectSummaries();
        throw new Error("プロジェクトが見つかりません。一覧を更新しました。");
      }
    },
    [mergeResultsIntoProject, refreshProjectSummaries],
  );

  const handleClearResults = useCallback(
    async (projectId: string) => {
      const ok = await clearResultsForProject(projectId);
      if (!ok) {
        await refreshProjectSummaries();
        throw new Error("プロジェクトが見つかりません。一覧を更新しました。");
      }
    },
    [clearResultsForProject, refreshProjectSummaries],
  );

  const handleExportYaml = useCallback(async (projectId: string) => {
    const record = await getProject(projectId);
    if (!record) throw new Error("プロジェクトが見つかりません");
    downloadText(serializeTestsYaml(record.definition), "tests.yml", "text/yaml");
  }, []);

  const handleExportResults = useCallback(async (projectId: string) => {
    const record = await getProject(projectId);
    if (!record) throw new Error("プロジェクトが見つかりません");
    downloadText(serializeResultsJson(record.results), "results.json", "application/json");
  }, []);

  const handleDelete = useCallback(
    async (projectId: string) => {
      await deleteProject(projectId);
    },
    [deleteProject],
  );

  if (!ready) return null;

  return (
    <main className="mx-auto max-w-2xl px-5 py-8 pb-12">
      <header className="mb-8 flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="mb-1 text-3xl font-bold tracking-tight">プロジェクト</h1>
          <p className="text-sm text-muted-foreground">
            登録済みの tests.yml を切り替えて作業できます
          </p>
        </div>
        <Button onClick={() => navigate("/load")}>新しいプロジェクトを追加</Button>
      </header>

      {projectSummaries.length === 0 ? (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">プロジェクトがありません</CardTitle>
            <CardDescription>
              tests.yml を読み込んで、最初のプロジェクトを追加してください。
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button onClick={() => navigate("/load")}>tests.yml を読み込む</Button>
          </CardContent>
        </Card>
      ) : (
        <div className="flex flex-col gap-6">
          {projectSummaries.map((summary) => (
            <ProjectCard
              key={summary.projectId}
              projectId={summary.projectId}
              name={summary.name}
              updatedAt={summary.updatedAt}
              hasValidSession={summary.hasValidSession}
              isLastOpened={summary.projectId === lastOpenedProjectId}
              onContinue={() =>
                void handleContinue(summary.projectId, summary.hasValidSession)
              }
              onMerge={(files) => handleMerge(summary.projectId, files)}
              onClearResults={() => handleClearResults(summary.projectId)}
              onExportYaml={() => handleExportYaml(summary.projectId)}
              onExportResults={() => handleExportResults(summary.projectId)}
              onDelete={() => handleDelete(summary.projectId)}
            />
          ))}
        </div>
      )}
    </main>
  );
}

import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { getProjectIdFromDefinition, parseTestsYaml } from "@qarows/shared";
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
  Input,
  Label,
} from "@qarows/ui";
import { classifyDroppedFiles, FileDropZone } from "@/components/FileDropZone";
import { TestsYamlGuide } from "@/components/TestsYamlGuide";
import { useProjects } from "@/context/ProjectsContext";
import { ApiError } from "@/lib/api/client";
import { projectPath } from "@/lib/project-routes";
import { readFileAsText } from "@/lib/file-utils";

export function ProjectImportPanel() {
  const navigate = useNavigate();
  const { importProject, createNamedProject, projectSummaries } = useProjects();

  const [testsFile, setTestsFile] = useState<File | null>(null);
  const [projectName, setProjectName] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [errorShake, setErrorShake] = useState(false);
  const [overwriteDialogOpen, setOverwriteDialogOpen] = useState(false);
  const [pendingImport, setPendingImport] = useState<{
    projectId: string;
    name: string;
    yaml: string;
  } | null>(null);

  const showError = (message: string) => {
    setError(message);
    setErrorShake(true);
    setTimeout(() => setErrorShake(false), 350);
  };

  const applyInitialFiles = (files: File[]) => {
    const { tests, results, unknown } = classifyDroppedFiles(files);
    if (tests) setTestsFile(tests);
    if (results.length > 0) {
      showError("Phase 2 では results.json はインポート時に取り込めません。ワークスペースで同期します。");
    }
    if (unknown.length > 0) {
      showError(`未対応のファイル: ${unknown.map((f) => f.name).join(", ")}`);
    } else if (results.length === 0) {
      setError(null);
    }
  };

  const clearLocalFiles = () => {
    setTestsFile(null);
    setError(null);
  };

  const loadSample = async () => {
    setError(null);
    try {
      const response = await fetch("/samples/tests.yml");
      if (!response.ok) throw new Error("サンプルファイルの取得に失敗しました");
      const text = await response.text();
      const blob = new Blob([text], { type: "text/yaml" });
      setTestsFile(new File([blob], "tests.yml", { type: "text/yaml" }));
    } catch (err) {
      showError(err instanceof Error ? err.message : "サンプルの読み込みに失敗しました");
    }
  };

  const finishImport = async (yaml: string, existingProjectId?: string) => {
    const projectId = await importProject(yaml, existingProjectId);
    clearLocalFiles();
    setOverwriteDialogOpen(false);
    setPendingImport(null);
    navigate(projectPath(projectId, "session"));
  };

  const performLoad = async () => {
    if (!testsFile) return;
    setLoading(true);
    setError(null);
    try {
      const yaml = await readFileAsText(testsFile);
      const parsedDefinition = parseTestsYaml(yaml);
      const projectId = getProjectIdFromDefinition(parsedDefinition);
      const existing = projectSummaries.find((summary) => summary.id === projectId);

      if (existing) {
        setPendingImport({
          projectId,
          name: parsedDefinition.project.name,
          yaml,
        });
        setOverwriteDialogOpen(true);
        return;
      }

      await finishImport(yaml);
    } catch (err) {
      if (err instanceof ApiError && err.status === 409) {
        showError("同じ id のプロジェクトが既に存在します");
      } else {
        showError(err instanceof Error ? err.message : "読み込みに失敗しました");
      }
    } finally {
      setLoading(false);
    }
  };

  const handleConfirmOverwrite = async () => {
    if (!pendingImport) return;
    setLoading(true);
    setError(null);
    try {
      await finishImport(pendingImport.yaml, pendingImport.projectId);
    } catch (err) {
      showError(err instanceof Error ? err.message : "読み込みに失敗しました");
    } finally {
      setLoading(false);
    }
  };

  const handleCreateEmpty = async () => {
    const name = projectName.trim();
    if (!name) {
      showError("プロジェクト名を入力してください");
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const projectId = await createNamedProject(name);
      setProjectName("");
      navigate(projectPath(projectId, "session"));
    } catch (err) {
      showError(err instanceof Error ? err.message : "プロジェクトの作成に失敗しました");
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <Card className="flex h-full min-h-0 flex-col overflow-hidden">
        <CardHeader className="shrink-0 pb-3">
          <CardTitle className="text-lg">新規作成</CardTitle>
          <CardDescription>
            tests.yml をアップロードするか、空のプロジェクトを作成します
          </CardDescription>
        </CardHeader>
        <CardContent className="min-h-0 flex-1 overflow-y-auto">
          <TestsYamlGuide />

          <div className="mt-6">
            <FileDropZone
              title="ファイルをここにドロップ"
              hint="tests.yml をドロップするか、クリックして選択"
              accept=".yml,.yaml"
              onFiles={applyInitialFiles}
            />
          </div>

          {(testsFile || error) && testsFile && (
            <ul className="mt-6 flex flex-col gap-2">
              <li className="flex items-center justify-between gap-3 rounded-lg border bg-card px-3.5 py-2.5 text-sm">
                <span className="break-all font-medium">{testsFile.name}</span>
                <Badge>必須</Badge>
              </li>
            </ul>
          )}

          <footer className="mt-6 flex flex-wrap items-center gap-3">
            <Button disabled={!testsFile || loading} onClick={() => void performLoad()}>
              {loading ? "読み込み中…" : "読み込む"}
            </Button>
            <Button variant="ghost" onClick={() => void loadSample()}>
              サンプルを試す
            </Button>
            {testsFile && (
              <Button variant="outline" onClick={clearLocalFiles}>
                選択をクリア
              </Button>
            )}
          </footer>

          <div className="mt-8 rounded-lg border bg-muted/20 px-4 py-4">
            <Label htmlFor="empty-project-name" className="text-sm font-medium">
              空のプロジェクト
            </Label>
            <p className="mt-1 text-xs text-muted-foreground">
              最小構成の tests.yml をサーバー側で生成します
            </p>
            <div className="mt-3 flex flex-wrap gap-2">
              <Input
                id="empty-project-name"
                value={projectName}
                placeholder="プロジェクト名"
                onChange={(event) => setProjectName(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === "Enter") void handleCreateEmpty();
                }}
              />
              <Button
                type="button"
                variant="secondary"
                disabled={loading || !projectName.trim()}
                onClick={() => void handleCreateEmpty()}
              >
                作成
              </Button>
            </div>
          </div>

          {error && (
            <Alert variant="destructive" className={cn("mt-4", errorShake && "animate-ui-shake")}>
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}
        </CardContent>
      </Card>

      <Dialog open={overwriteDialogOpen} onOpenChange={setOverwriteDialogOpen}>
        <DialogContent showCloseButton={false}>
          <DialogHeader>
            <DialogTitle>既存プロジェクトを上書きしますか？</DialogTitle>
            <DialogDescription asChild>
              <div className="space-y-2 text-sm text-muted-foreground">
                <p>
                  「{pendingImport?.name}」（id: {pendingImport?.projectId}）は既に登録されています。
                </p>
                <p>tests.yml を読み込むと、定義・結果・セッションがすべて置き換わります。</p>
              </div>
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setOverwriteDialogOpen(false);
                setPendingImport(null);
              }}
            >
              キャンセル
            </Button>
            <Button
              variant="destructive"
              disabled={loading}
              onClick={() => void handleConfirmOverwrite()}
            >
              {loading ? "読み込み中…" : "上書きする"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

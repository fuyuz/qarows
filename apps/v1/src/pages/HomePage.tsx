import { useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  createEmptyResults,
  mergeResultsFiles,
  parseResultsJson,
  parseTestsYaml,
  serializeResultsJson,
} from "@qarows/shared";
import { AppNav } from "@/components/AppNav";
import { classifyDroppedFiles, FileDropZone } from "@/components/FileDropZone";
import { TestsYamlGuide } from "@/components/TestsYamlGuide";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { readFileAsText } from "@/lib/utils";
import { useApp } from "@/context/AppContext";
import { projectPath } from "@/lib/project-routes";
import { cn } from "@/lib/cn";

function fileKey(file: File): string {
  return `${file.name}:${file.size}:${file.lastModified}`;
}

function appendUniqueFiles(prev: File[], incoming: File[]): File[] {
  const seen = new Set(prev.map(fileKey));
  const next = [...prev];
  for (const file of incoming) {
    const key = fileKey(file);
    if (seen.has(key)) continue;
    seen.add(key);
    next.push(file);
  }
  return next;
}

async function mergeResultsJsonStrings(yaml: string, jsons: string[]): Promise<string | undefined> {
  if (jsons.length === 0) return undefined;
  const parsedDefinition = parseTestsYaml(yaml);
  const projectId = parsedDefinition.project.id ?? "project";
  let merged = createEmptyResults(projectId);
  for (const json of jsons) {
    merged = mergeResultsFiles(merged, parseResultsJson(json, { definition: parsedDefinition }));
  }
  return serializeResultsJson(merged);
}

export function HomePage() {
  const navigate = useNavigate();
  const { loadProject, projectSummaries } = useApp();

  const [testsFile, setTestsFile] = useState<File | null>(null);
  const [resultsFiles, setResultsFiles] = useState<File[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [errorShake, setErrorShake] = useState(false);
  const [overwriteDialogOpen, setOverwriteDialogOpen] = useState(false);
  const [pendingImport, setPendingImport] = useState<{
    projectId: string;
    name: string;
    yaml: string;
    resultsJson?: string;
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
      setResultsFiles((prev) => appendUniqueFiles(prev, results));
    }
    if (unknown.length > 0) {
      showError(`未対応のファイル: ${unknown.map((f) => f.name).join(", ")}`);
    } else {
      setError(null);
    }
  };

  const clearLocalFiles = () => {
    setTestsFile(null);
    setResultsFiles([]);
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
      setResultsFiles([]);
    } catch (err) {
      showError(err instanceof Error ? err.message : "サンプルの読み込みに失敗しました");
    }
  };

  const finishImport = async (yaml: string, resultsJson?: string) => {
    const projectId = await loadProject(yaml, resultsJson);
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
      const jsons = await Promise.all(resultsFiles.map((file) => readFileAsText(file)));
      const resultsJson = await mergeResultsJsonStrings(yaml, jsons);
      const parsedDefinition = parseTestsYaml(yaml);
      const projectId = parsedDefinition.project.id ?? "project";
      const existing = projectSummaries.find((summary) => summary.projectId === projectId);

      if (existing) {
        setPendingImport({
          projectId,
          name: parsedDefinition.project.name,
          yaml,
          resultsJson,
        });
        setOverwriteDialogOpen(true);
        return;
      }

      await finishImport(yaml, resultsJson);
    } catch (err) {
      showError(err instanceof Error ? err.message : "読み込みに失敗しました");
    } finally {
      setLoading(false);
    }
  };

  const handleConfirmOverwrite = async () => {
    if (!pendingImport) return;
    setLoading(true);
    setError(null);
    try {
      await finishImport(pendingImport.yaml, pendingImport.resultsJson);
    } catch (err) {
      showError(err instanceof Error ? err.message : "読み込みに失敗しました");
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <AppNav />
      <main className="mx-auto max-w-2xl px-5 py-8 pb-12">
        <header className="mb-8">
          <div className="mb-4">
            <Button variant="ghost" size="sm" className="-ml-2" onClick={() => navigate("/projects")}>
              ← プロジェクト一覧
            </Button>
          </div>
          <h1 className="mb-1 text-3xl font-bold tracking-tight">プロジェクトを追加</h1>
          <p className="text-sm text-muted-foreground">
            tests.yml と results.json（任意・複数可）を読み込みます
          </p>
        </header>

        <TestsYamlGuide />

        <div className="mt-6">
          <FileDropZone
            title="ファイルをここにドロップ"
            hint="tests.yml（必須）と results.json（任意・複数）を同時にドロップできます"
            accept=".yml,.yaml,.json"
            onFiles={applyInitialFiles}
          />
        </div>

        {(testsFile || resultsFiles.length > 0) && (
          <ul className="mt-6 flex flex-col gap-2">
            {testsFile && (
              <li className="flex items-center justify-between gap-3 rounded-lg border bg-card px-3.5 py-2.5 text-sm">
                <span className="break-all font-medium">{testsFile.name}</span>
                <Badge>必須</Badge>
              </li>
            )}
            {resultsFiles.map((file) => (
              <li
                key={fileKey(file)}
                className="flex items-center justify-between gap-3 rounded-lg border bg-card px-3.5 py-2.5 text-sm"
              >
                <span className="min-w-0 break-all font-medium">{file.name}</span>
                <div className="flex shrink-0 items-center gap-2">
                  <Badge variant="secondary">results</Badge>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() =>
                      setResultsFiles((prev) =>
                        prev.filter((entry) => fileKey(entry) !== fileKey(file)),
                      )
                    }
                  >
                    削除
                  </Button>
                </div>
              </li>
            ))}
          </ul>
        )}

        <footer className="mt-6 flex flex-wrap items-center gap-3">
          <Button disabled={!testsFile || loading} onClick={() => void performLoad()}>
            {loading ? "読み込み中…" : "読み込む"}
          </Button>
          <Button variant="ghost" onClick={() => void loadSample()}>
            サンプルを試す
          </Button>
          {(testsFile || resultsFiles.length > 0) && (
            <Button variant="outline" onClick={clearLocalFiles}>
              選択をクリア
            </Button>
          )}
        </footer>

        {error && (
          <Alert variant="destructive" className={cn("mt-4", errorShake && "animate-ui-shake")}>
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}
      </main>

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
            <Button variant="destructive" disabled={loading} onClick={() => void handleConfirmOverwrite()}>
              {loading ? "読み込み中…" : "上書きする"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

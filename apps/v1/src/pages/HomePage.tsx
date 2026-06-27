import { useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  createEmptyResults,
  isValidSession,
  mergeResultsFiles,
  parseResultsJson,
  parseTestsYaml,
  serializeResultsJson,
} from "@qarows/shared";
import { AppNav } from "@/components/AppNav";
import { classifyDroppedFiles, classifyResultsFiles, FileDropZone } from "@/components/FileDropZone";
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
import { Separator } from "@/components/ui/separator";
import { readFileAsText } from "@/lib/utils";
import { useApp } from "@/context/AppContext";
import { useProjectRoutes } from "@/hooks/useProjectRoutes";
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

function ResultsFileList({
  files,
  badgeLabel,
  onRemove,
}: {
  files: File[];
  badgeLabel: string;
  onRemove: (index: number) => void;
}) {
  if (files.length === 0) return null;
  return (
    <ul className="mt-4 flex flex-col gap-2">
      {files.map((file, index) => (
        <li
          key={fileKey(file)}
          className="flex items-center justify-between gap-3 rounded-lg border bg-card px-3.5 py-2.5 text-sm animate-in fade-in slide-in-from-bottom-2 duration-250 fill-mode-both"
        >
          <span className="min-w-0 break-all font-medium">{file.name}</span>
          <div className="flex shrink-0 items-center gap-2">
            <Badge variant="secondary">{badgeLabel}</Badge>
            <Button type="button" variant="ghost" size="sm" onClick={() => onRemove(index)}>
              削除
            </Button>
          </div>
        </li>
      ))}
    </ul>
  );
}

export function HomePage() {
  const navigate = useNavigate();
  const { definition, session, loadProject, mergeResultsFromFiles, clearResults, resetProject } =
    useApp();
  const { path } = useProjectRoutes();
  const isLoaded = definition != null;

  const [testsFile, setTestsFile] = useState<File | null>(null);
  const [resultsFiles, setResultsFiles] = useState<File[]>([]);
  const [additionalResultsFiles, setAdditionalResultsFiles] = useState<File[]>([]);
  const [loading, setLoading] = useState(false);
  const [merging, setMerging] = useState(false);
  const [clearingResults, setClearingResults] = useState(false);
  const [clearingProject, setClearingProject] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [errorShake, setErrorShake] = useState(false);
  const [clearResultsDialogOpen, setClearResultsDialogOpen] = useState(false);
  const [clearProjectDialogOpen, setClearProjectDialogOpen] = useState(false);

  const showError = (message: string) => {
    setError(message);
    setSuccessMessage(null);
    setErrorShake(true);
    setTimeout(() => setErrorShake(false), 350);
  };

  const appendAdditionalResults = (files: File[]) => {
    const { results, unknown } = classifyResultsFiles(files);
    if (unknown.length > 0) {
      showError(`未対応のファイル: ${unknown.map((f) => f.name).join(", ")}`);
    } else {
      setError(null);
    }
    if (results.length === 0) return;
    setAdditionalResultsFiles((prev) => appendUniqueFiles(prev, results));
    setSuccessMessage(null);
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
    setAdditionalResultsFiles([]);
    setError(null);
    setSuccessMessage(null);
  };

  const loadSample = async () => {
    setError(null);
    setSuccessMessage(null);
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

  const performLoad = async () => {
    if (!testsFile) return;
    setLoading(true);
    setError(null);
    setSuccessMessage(null);
    try {
      const yaml = await readFileAsText(testsFile);
      const jsons = await Promise.all(resultsFiles.map((file) => readFileAsText(file)));
      const resultsJson = await mergeResultsJsonStrings(yaml, jsons);
      const projectId = await loadProject(yaml, resultsJson);
      clearLocalFiles();
      navigate(projectPath(projectId, "session"));
    } catch (err) {
      showError(err instanceof Error ? err.message : "読み込みに失敗しました");
    } finally {
      setLoading(false);
    }
  };

  const handleImportAdditionalResults = async () => {
    if (additionalResultsFiles.length === 0) return;
    setMerging(true);
    setError(null);
    setSuccessMessage(null);
    try {
      const jsons = await Promise.all(additionalResultsFiles.map((file) => readFileAsText(file)));
      await mergeResultsFromFiles(jsons);
      setAdditionalResultsFiles([]);
      setSuccessMessage(`${jsons.length} 件の results.json を取り込みました`);
    } catch (err) {
      showError(err instanceof Error ? err.message : "results.json の取り込みに失敗しました");
    } finally {
      setMerging(false);
    }
  };

  const handleClearResults = async () => {
    setClearingResults(true);
    setError(null);
    setSuccessMessage(null);
    try {
      await clearResults();
      setAdditionalResultsFiles([]);
      setClearResultsDialogOpen(false);
      setSuccessMessage("テスト結果をクリアしました");
    } catch (err) {
      showError(err instanceof Error ? err.message : "テスト結果のクリアに失敗しました");
    } finally {
      setClearingResults(false);
    }
  };

  const handleUnloadProject = async () => {
    setClearingProject(true);
    setError(null);
    setSuccessMessage(null);
    try {
      await resetProject();
      clearLocalFiles();
      setClearProjectDialogOpen(false);
    } catch (err) {
      showError(err instanceof Error ? err.message : "tests.yml の読み込み解除に失敗しました");
    } finally {
      setClearingProject(false);
    }
  };

  return (
    <>
      <AppNav />
      <main className="mx-auto max-w-2xl px-5 py-8 pb-12">
        <header className="mb-8">
          <h1 className="mb-1 text-3xl font-bold tracking-tight">qarows</h1>
          <p className="text-sm text-muted-foreground">
            {isLoaded
              ? "読み込み済みの tests.yml に対して、results.json の追加や結果の管理ができます"
              : "tests.yml と results.json（任意・複数可）を読み込んで、QA テストを開始します"}
          </p>
        </header>

        <TestsYamlGuide />

        {isLoaded ? (
          <>
            <section className="mb-8 mt-6 rounded-xl border bg-card px-4 py-4 shadow-sm">
              <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                <div className="min-w-0">
                  <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                    読み込み済み
                  </p>
                  <p className="mt-1 text-lg font-semibold">{definition.project.name}</p>
                </div>
                <div className="flex flex-wrap gap-2">
                  <Button variant="outline" onClick={() => navigate(path("session"))}>
                    セッション設定へ
                  </Button>
                  {session && isValidSession(session) && (
                    <Button onClick={() => navigate(path("run"))}>テスト実行を続ける</Button>
                  )}
                </div>
              </div>
            </section>

            <section className="mb-8">
              <h2 className="mb-1 text-base font-semibold">results.json を追加</h2>
              <p className="mb-4 text-sm text-muted-foreground">
                追加の results.json をマージして取り込みます。ステータスは強い方、メモは両方残します。
              </p>
              <FileDropZone
                title="results.json をここにドロップ"
                hint="複数ファイルを同時に選べます"
                accept=".json,application/json"
                onFiles={appendAdditionalResults}
              />
              <ResultsFileList
                files={additionalResultsFiles}
                badgeLabel="待機中"
                onRemove={(index) =>
                  setAdditionalResultsFiles((prev) => prev.filter((_, i) => i !== index))
                }
              />
              <div className="mt-4">
                <Button
                  type="button"
                  variant="outline"
                  disabled={additionalResultsFiles.length === 0 || merging}
                  onClick={() => void handleImportAdditionalResults()}
                >
                  {merging ? "取り込み中…" : "取り込む"}
                </Button>
              </div>
            </section>

            <Separator className="my-8" />

            <section className="mb-6">
              <h2 className="mb-1 text-base font-semibold">管理</h2>
              <p className="mb-4 text-sm text-muted-foreground">
                テスト結果だけ消すか、tests.yml の読み込み自体を解除できます。
              </p>
              <div className="flex flex-wrap gap-2">
                <Button
                  type="button"
                  variant="destructive"
                  onClick={() => setClearResultsDialogOpen(true)}
                >
                  テスト結果をクリア
                </Button>
                <Button
                  type="button"
                  variant="destructive"
                  onClick={() => setClearProjectDialogOpen(true)}
                >
                  tests.yml の読み込みを解除
                </Button>
              </div>
            </section>
          </>
        ) : (
          <>
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
                  <li
                    key={testsFile.name}
                    className="flex items-center justify-between gap-3 rounded-lg border bg-card px-3.5 py-2.5 text-sm animate-in fade-in slide-in-from-bottom-2 duration-250 fill-mode-both"
                  >
                    <span className="break-all font-medium">{testsFile.name}</span>
                    <Badge>必須</Badge>
                  </li>
                )}
                {resultsFiles.map((file) => (
                  <li
                    key={fileKey(file)}
                    className="flex items-center justify-between gap-3 rounded-lg border bg-card px-3.5 py-2.5 text-sm animate-in fade-in slide-in-from-bottom-2 duration-250 fill-mode-both"
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
                {loading ? "読み込み中…" : "テストを開始"}
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
          </>
        )}

        {successMessage && (
          <Alert className="mt-4 border-emerald-200 bg-emerald-50 text-emerald-900">
            <AlertDescription>{successMessage}</AlertDescription>
          </Alert>
        )}

        {error && (
          <Alert variant="destructive" className={cn("mt-4", errorShake && "animate-ui-shake")}>
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}
      </main>

      <Dialog open={clearResultsDialogOpen} onOpenChange={setClearResultsDialogOpen}>
        <DialogContent showCloseButton={false}>
          <DialogHeader>
            <DialogTitle>テスト結果をクリアしますか？</DialogTitle>
            <DialogDescription asChild>
              <div className="space-y-2 text-sm text-muted-foreground">
                <p>実行結果、バグ、セッション設定を削除します。</p>
                <p>tests.yml のテスト定義は残ります。元に戻せないため、必要な results.json は先にエクスポートしてください。</p>
              </div>
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setClearResultsDialogOpen(false)}>
              キャンセル
            </Button>
            <Button
              variant="destructive"
              disabled={clearingResults}
              onClick={() => void handleClearResults()}
            >
              {clearingResults ? "クリア中…" : "テスト結果をクリア"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={clearProjectDialogOpen} onOpenChange={setClearProjectDialogOpen}>
        <DialogContent showCloseButton={false}>
          <DialogHeader>
            <DialogTitle>tests.yml の読み込みを解除しますか？</DialogTitle>
            <DialogDescription asChild>
              <div className="space-y-2 text-sm text-muted-foreground">
                <p>tests.yml、実行結果、バグ、セッション設定をすべて削除します。</p>
                <p>元に戻せないため、必要なファイルは先にエクスポートしてください。</p>
              </div>
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setClearProjectDialogOpen(false)}>
              キャンセル
            </Button>
            <Button
              variant="destructive"
              disabled={clearingProject}
              onClick={() => void handleUnloadProject()}
            >
              {clearingProject ? "解除中…" : "読み込みを解除"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

import { useState } from "react";
import { useNavigate } from "react-router-dom";
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
import { cn } from "@/lib/cn";

export function HomePage() {
  const navigate = useNavigate();
  const { definition, loadProject } = useApp();
  const [testsFile, setTestsFile] = useState<File | null>(null);
  const [resultsFile, setResultsFile] = useState<File | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [errorShake, setErrorShake] = useState(false);
  const [replaceDialogOpen, setReplaceDialogOpen] = useState(false);

  const showError = (message: string) => {
    setError(message);
    setErrorShake(true);
    setTimeout(() => setErrorShake(false), 350);
  };

  const applyFiles = (files: File[]) => {
    const { tests, results, unknown } = classifyDroppedFiles(files);
    if (tests) setTestsFile(tests);
    if (results) setResultsFile(results);
    if (unknown.length > 0) {
      showError(`未対応のファイル: ${unknown.map((f) => f.name).join(", ")}`);
    } else {
      setError(null);
    }
  };

  const loadSample = async () => {
    setError(null);
    try {
      const response = await fetch("/samples/tests.yml");
      if (!response.ok) throw new Error("サンプルファイルの取得に失敗しました");
      const text = await response.text();
      const blob = new Blob([text], { type: "text/yaml" });
      setTestsFile(new File([blob], "tests.yml", { type: "text/yaml" }));
      setResultsFile(null);
    } catch (err) {
      showError(err instanceof Error ? err.message : "サンプルの読み込みに失敗しました");
    }
  };

  const performLoad = async () => {
    if (!testsFile) return;
    setLoading(true);
    setError(null);
    try {
      const yaml = await readFileAsText(testsFile);
      const resultsJson = resultsFile ? await readFileAsText(resultsFile) : undefined;
      await loadProject(yaml, resultsJson);
      navigate("/session");
    } catch (err) {
      showError(err instanceof Error ? err.message : "読み込みに失敗しました");
    } finally {
      setLoading(false);
    }
  };

  const handleStart = () => {
    if (!testsFile || loading) return;
    if (definition) {
      setReplaceDialogOpen(true);
      return;
    }
    void performLoad();
  };

  const handleConfirmReplace = () => {
    setReplaceDialogOpen(false);
    void performLoad();
  };

  return (
    <>
      <AppNav />
      <main className="mx-auto max-w-2xl px-5 py-8 pb-12">
        <header className="mb-8">
          <h1 className="mb-1 text-3xl font-bold tracking-tight">qarows</h1>
          <p className="text-sm text-muted-foreground">
            tests.yml と results.json（任意）を読み込んで、QA テストを開始します
          </p>
        </header>

        {definition && (
          <Alert className="mb-6 border-amber-200 bg-amber-50 text-amber-900">
            <AlertDescription>
              現在のプロジェクト: <strong>{definition.project.name}</strong>
              （新しいファイルを読み込むと置き換わります）
            </AlertDescription>
          </Alert>
        )}

        <TestsYamlGuide />

        <FileDropZone
          title="ファイルをここにドロップ"
          hint="tests.yml（必須）と results.json（任意）を同時にドロップできます"
          accept=".yml,.yaml,.json"
          onFiles={applyFiles}
        />

        {(testsFile || resultsFile) && (
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
            {resultsFile && (
              <li
                key={resultsFile.name}
                className="flex items-center justify-between gap-3 rounded-lg border bg-card px-3.5 py-2.5 text-sm animate-in fade-in slide-in-from-bottom-2 duration-250 fill-mode-both"
              >
                <span className="break-all font-medium">{resultsFile.name}</span>
                <Badge variant="secondary">任意</Badge>
              </li>
            )}
          </ul>
        )}

        {error && (
          <Alert variant="destructive" className={cn("mt-4", errorShake && "animate-ui-shake")}>
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        <footer className="mt-6 flex flex-wrap items-center gap-3">
          <Button disabled={!testsFile || loading} onClick={handleStart}>
            {loading ? "読み込み中…" : "テストを開始"}
          </Button>
          <Button variant="ghost" onClick={() => void loadSample()}>
            サンプルを試す
          </Button>
        </footer>
      </main>

      <Dialog open={replaceDialogOpen} onOpenChange={setReplaceDialogOpen}>
        <DialogContent showCloseButton={false}>
          <DialogHeader>
            <DialogTitle>プロジェクトを置き換えますか？</DialogTitle>
            <DialogDescription asChild>
              <div className="space-y-2 text-sm text-muted-foreground">
                <p>
                  現在のプロジェクト「<strong className="text-foreground">{definition?.project.name}</strong>
                  」を新しい tests.yml で置き換えます。
                </p>
                <p>
                  実行結果・セッション設定・テスト進行状況は失われます。results.json
                  を同時に選んでいない場合、結果は空の状態から始まります。
                </p>
              </div>
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setReplaceDialogOpen(false)}>
              キャンセル
            </Button>
            <Button variant="destructive" disabled={loading} onClick={handleConfirmReplace}>
              置き換える
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { AppNav } from "@/components/AppNav";
import { classifyDroppedFiles, FileDropZone } from "@/components/FileDropZone";
import { readFileAsText } from "@/lib/utils";
import { useApp } from "@/context/AppContext";

export function HomePage() {
  const navigate = useNavigate();
  const { definition, loadProject } = useApp();
  const [testsFile, setTestsFile] = useState<File | null>(null);
  const [resultsFile, setResultsFile] = useState<File | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const applyFiles = (files: File[]) => {
    const { tests, results, unknown } = classifyDroppedFiles(files);
    if (tests) setTestsFile(tests);
    if (results) setResultsFile(results);
    if (unknown.length > 0) {
      setError(`未対応のファイル: ${unknown.map((f) => f.name).join(", ")}`);
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
      setError(err instanceof Error ? err.message : "サンプルの読み込みに失敗しました");
    }
  };

  const handleStart = async () => {
    if (!testsFile) return;
    setLoading(true);
    setError(null);
    try {
      const yaml = await readFileAsText(testsFile);
      const resultsJson = resultsFile ? await readFileAsText(resultsFile) : undefined;
      await loadProject(yaml, resultsJson);
      navigate("/session");
    } catch (err) {
      setError(err instanceof Error ? err.message : "読み込みに失敗しました");
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <AppNav />
      <main className="page">
      <header className="page__header">
        <h1 className="page__title">qarows</h1>
        <p className="page__subtitle">
          tests.yml と results.json（任意）を読み込んで、QA テストを開始します
        </p>
      </header>

      {definition && (
        <p className="page__notice">
          現在のプロジェクト: <strong>{definition.project.name}</strong>
          （新しいファイルを読み込むと置き換わります）
        </p>
      )}

      <FileDropZone
        title="ファイルをここにドロップ"
        hint="tests.yml（必須）と results.json（任意）を同時にドロップできます"
        accept=".yml,.yaml,.json"
        onFiles={applyFiles}
      />

      {(testsFile || resultsFile) && (
        <ul className="file-list">
          {testsFile && (
            <li className="file-list__item">
              <span className="file-list__name">{testsFile.name}</span>
              <span className="file-list__badge">必須</span>
            </li>
          )}
          {resultsFile && (
            <li className="file-list__item">
              <span className="file-list__name">{resultsFile.name}</span>
              <span className="file-list__badge file-list__badge--optional">任意</span>
            </li>
          )}
        </ul>
      )}

      {error && <div className="error-banner">{error}</div>}

      <footer className="page__footer">
        <button
          type="button"
          className="btn btn--primary"
          disabled={!testsFile || loading}
          onClick={() => void handleStart()}
        >
          {loading ? "読み込み中…" : "テストを開始"}
        </button>
        <button type="button" className="btn btn--ghost" onClick={() => void loadSample()}>
          サンプルを試す
        </button>
      </footer>
      </main>
    </>
  );
}

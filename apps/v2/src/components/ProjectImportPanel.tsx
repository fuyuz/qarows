import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { getProjectIdFromDefinition, parseTestsYaml } from "@qarows/shared";
import {
  Badge,
  Button,
  classifyDroppedFiles,
  FileDropZone,
  Input,
  Label,
  ProjectImportShell,
  ProjectOverwriteDialog,
} from "@qarows/ui";
import { useProjects } from "@/context/ProjectsContext";
import { ApiError } from "@/lib/api/client";
import { projectPath } from "@/lib/project-routes";
import { appendUniqueFiles, fileKey, readFileAsText } from "@/lib/file-utils";

export function ProjectImportPanel() {
  const navigate = useNavigate();
  const { importProject, createNamedProject, projectSummaries } = useProjects();

  const [testsFile, setTestsFile] = useState<File | null>(null);
  const [resultsFiles, setResultsFiles] = useState<File[]>([]);
  const [projectName, setProjectName] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [errorShake, setErrorShake] = useState(false);
  const [overwriteDialogOpen, setOverwriteDialogOpen] = useState(false);
  const [pendingImport, setPendingImport] = useState<{
    projectId: string;
    name: string;
    yaml: string;
    resultsJsonList: string[];
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
    } catch (err) {
      showError(err instanceof Error ? err.message : "サンプルの読み込みに失敗しました");
    }
  };

  const readResultsJsonList = async (files: File[]): Promise<string[]> => {
    if (files.length === 0) return [];
    return Promise.all(files.map((file) => readFileAsText(file)));
  };

  const finishImport = async (
    yaml: string,
    resultsJsonList: string[],
    existingProjectId?: string,
  ) => {
    const projectId = await importProject(yaml, { existingProjectId, resultsJsonList });
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
      const resultsJsonList = await readResultsJsonList(resultsFiles);
      const parsedDefinition = parseTestsYaml(yaml);
      const projectId = getProjectIdFromDefinition(parsedDefinition);
      const existing = projectSummaries.find((summary) => summary.id === projectId);

      if (existing) {
        setPendingImport({
          projectId,
          name: parsedDefinition.project.name,
          yaml,
          resultsJsonList,
        });
        setOverwriteDialogOpen(true);
        return;
      }

      await finishImport(yaml, resultsJsonList);
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
      await finishImport(
        pendingImport.yaml,
        pendingImport.resultsJsonList,
        pendingImport.projectId,
      );
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
      <ProjectImportShell
        description="tests.yml と results.json（任意・複数可）をアップロードするか、空のプロジェクトを作成します"
        error={error}
        errorShake={errorShake}
        footer={
          <>
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
          </>
        }
        extra={
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
        }
      >
        <FileDropZone
          title="ファイルをここにドロップ"
          hint="tests.yml（必須）と results.json（任意・複数）を同時にドロップできます"
          accept=".yml,.yaml,.json,application/json"
          onFiles={applyInitialFiles}
        />

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
                <span className="break-all font-medium">{file.name}</span>
                <Badge variant="secondary">results</Badge>
              </li>
            ))}
          </ul>
        )}
      </ProjectImportShell>

      <ProjectOverwriteDialog
        open={overwriteDialogOpen}
        projectName={pendingImport?.name ?? ""}
        projectId={pendingImport?.projectId ?? ""}
        loading={loading}
        onOpenChange={setOverwriteDialogOpen}
        onCancel={() => {
          setOverwriteDialogOpen(false);
          setPendingImport(null);
        }}
        onConfirm={() => void handleConfirmOverwrite()}
      />
    </>
  );
}

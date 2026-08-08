import { useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  createEmptyResults,
  expandImportFiles,
  getProjectIdFromDefinition,
  mergeResultsFiles,
  parseResultsJson,
  parseTestsYaml,
  serializeResultsJson,
} from "@qarows/shared";
import {
  classifyDroppedFiles,
  FileDropZone,
  ProjectImportShell,
  ProjectOverwriteDialog,
  Badge,
  Button,
  useTranslation,
} from "@qarows/ui";
import { useApp } from "@/context/AppContext";
import { projectPath } from "@/lib/project-routes";
import { readFileAsText, appendUniqueFiles, fileKey } from "@/lib/utils";

async function mergeResultsJsonStrings(yaml: string, jsons: string[]): Promise<string | undefined> {
  if (jsons.length === 0) return undefined;
  const parsedDefinition = parseTestsYaml(yaml);
  const projectId = getProjectIdFromDefinition(parsedDefinition);
  let merged = createEmptyResults(projectId);
  for (const json of jsons) {
    merged = mergeResultsFiles(merged, parseResultsJson(json, { definition: parsedDefinition }));
  }
  return serializeResultsJson(merged);
}

export function ProjectImportPanel() {
  const { t } = useTranslation();
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
    void (async () => {
      try {
        const expanded = await expandImportFiles(files);
        const { tests, results, unknown } = classifyDroppedFiles(expanded);
        if (tests) setTestsFile(tests);
        if (results.length > 0) {
          setResultsFiles((prev) => appendUniqueFiles(prev, results));
        }
        if (unknown.length > 0) {
          showError(t("error.unsupportedFiles", { files: unknown.map((f) => f.name).join(", ") }));
        } else {
          setError(null);
        }
      } catch (err) {
        showError(err instanceof Error ? err.message : t("error.extractFailed"));
      }
    })();
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
      if (!response.ok) throw new Error(t("error.sampleFetchFailed"));
      const text = await response.text();
      const blob = new Blob([text], { type: "text/yaml" });
      setTestsFile(new File([blob], "tests.yml", { type: "text/yaml" }));
      setResultsFiles([]);
    } catch (err) {
      showError(err instanceof Error ? err.message : t("error.sampleLoadFailed"));
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
      const projectId = getProjectIdFromDefinition(parsedDefinition);
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
      showError(err instanceof Error ? err.message : t("error.loadFailed"));
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
      showError(err instanceof Error ? err.message : t("error.loadFailed"));
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <ProjectImportShell
        description={t("project.importDescription")}
        error={error}
        errorShake={errorShake}
        footer={
          <>
            <Button disabled={!testsFile || loading} onClick={() => void performLoad()}>
              {loading ? t("common.loadingAction") : t("common.load")}
            </Button>
            <Button variant="ghost" onClick={() => void loadSample()}>
              {t("project.trySample")}
            </Button>
            {(testsFile || resultsFiles.length > 0) && (
              <Button variant="outline" onClick={clearLocalFiles}>
                {t("project.clearSelection")}
              </Button>
            )}
          </>
        }
      >
        <FileDropZone
          title={t("project.dropHere")}
          hint={t("project.dropHintExtended")}
          accept=".yml,.yaml,.json,.zip"
          onFiles={applyInitialFiles}
        />

        {(testsFile || resultsFiles.length > 0) && (
          <ul className="mt-6 flex flex-col gap-2">
            {testsFile && (
              <li className="flex items-center justify-between gap-3 rounded-lg border bg-card px-3.5 py-2.5 text-sm">
                <span className="break-all font-medium">{testsFile.name}</span>
                <Badge>{t("common.required")}</Badge>
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
                    {t("common.remove")}
                  </Button>
                </div>
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

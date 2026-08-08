import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { expandImportFiles, getProjectIdFromDefinition, parseTestsYaml } from "@qarows/shared";
import {
  Badge,
  Button,
  classifyDroppedFiles,
  FileDropZone,
  Input,
  Label,
  ProjectImportShell,
  ProjectOverwriteDialog,
  useTranslation,
} from "@qarows/ui";
import { useProjects } from "@/context/ProjectsContext";
import { ApiError } from "@/lib/api/client";
import { projectPath } from "@/lib/project-routes";
import { appendUniqueFiles, fileKey, readFileAsText } from "@/lib/file-utils";

export function ProjectImportPanel() {
  const { t } = useTranslation();
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
    } catch (err) {
      showError(err instanceof Error ? err.message : t("error.sampleLoadFailed"));
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
        showError(t("project.duplicateId"));
      } else {
        showError(err instanceof Error ? err.message : t("error.loadFailed"));
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
      showError(err instanceof Error ? err.message : t("error.loadFailed"));
    } finally {
      setLoading(false);
    }
  };

  const handleCreateEmpty = async () => {
    const name = projectName.trim();
    if (!name) {
      showError(t("error.enterProjectName"));
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const projectId = await createNamedProject(name);
      setProjectName("");
      navigate(projectPath(projectId, "session"));
    } catch (err) {
      showError(err instanceof Error ? err.message : t("error.createProjectFailed"));
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <ProjectImportShell
        description={t("project.importDescriptionTeam")}
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
        extra={
          <div className="mt-8 rounded-lg border bg-muted/20 px-4 py-4">
            <Label htmlFor="empty-project-name" className="text-sm font-medium">
              {t("project.emptyProject")}
            </Label>
            <p className="mt-1 text-xs text-muted-foreground">{t("project.emptyProjectHint")}</p>
            <div className="mt-3 flex flex-wrap gap-2">
              <Input
                id="empty-project-name"
                value={projectName}
                placeholder={t("project.projectNamePlaceholder")}
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
                {t("project.createEmpty")}
              </Button>
            </div>
          </div>
        }
      >
        <FileDropZone
          title={t("project.dropHere")}
          hint={t("project.dropHintExtended")}
          accept=".yml,.yaml,.json,application/json,.zip"
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

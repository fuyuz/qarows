import { useCallback, useEffect, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import {
  createEmptyResults,
  packProjectArchive,
  projectArchiveFilename,
  projectArchiveToBlob,
  serializeResultsJson,
  serializeTestsYaml,
} from "@qarows/shared";
import { ProjectDetailPanel } from "@/components/ProjectDetailPanel";
import { ProjectImportPanel } from "@/components/ProjectImportPanel";
import { ProjectList } from "@/components/ProjectList";
import { NEW_PROJECT_SELECTION, projectPath, RunnerCardTransition } from "@qarows/runner-ui";
import { useTranslation } from "@qarows/ui";
import { sortProjectSummaries } from "@qarows/application";
import { useApp } from "@/context/AppContext";
import { useProjectsQueryState } from "@/hooks/useProjectsQueryState";
import { readFileAsText, downloadText, downloadBlob } from "@/lib/utils";

function resolveDefaultSelection(
  summaries: ReturnType<typeof useApp>["projectSummaries"],
  lastOpenedProjectId: string | null,
): string {
  if (summaries.length === 0) return NEW_PROJECT_SELECTION;
  if (lastOpenedProjectId && summaries.some((summary) => summary.id === lastOpenedProjectId)) {
    return lastOpenedProjectId;
  }
  return sortProjectSummaries(summaries)[0].id;
}

export function ProjectsPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const {
    ready,
    projectSummaries,
    lastOpenedProjectId,
    activateProject,
    getProjectSnapshot,
    mergeResultsIntoProject,
    clearResultsForProject,
    deleteProject,
  } = useApp();
  const { projectId, setProjectId } = useProjectsQueryState();

  const defaultSelection = useMemo(
    () => resolveDefaultSelection(projectSummaries, lastOpenedProjectId),
    [projectSummaries, lastOpenedProjectId],
  );

  useEffect(() => {
    if (!ready) return;
    if (projectId != null) return;
    void setProjectId(defaultSelection);
  }, [ready, projectId, defaultSelection, setProjectId]);

  useEffect(() => {
    if (!ready || projectId == null) return;
    if (projectId === NEW_PROJECT_SELECTION) return;
    const exists = projectSummaries.some((summary) => summary.id === projectId);
    if (!exists) {
      void setProjectId(defaultSelection);
    }
  }, [ready, projectId, projectSummaries, defaultSelection, setProjectId]);

  const selectedSummary = useMemo(() => {
    if (!projectId || projectId === NEW_PROJECT_SELECTION) return null;
    return projectSummaries.find((summary) => summary.id === projectId) ?? null;
  }, [projectId, projectSummaries]);

  const handleContinue = useCallback(
    async (targetProjectId: string, hasValidSession: boolean) => {
      await activateProject(targetProjectId);
      navigate(projectPath(targetProjectId, hasValidSession ? "run" : "session"));
    },
    [activateProject, navigate],
  );

  const handleMerge = useCallback(
    async (targetProjectId: string, files: File[]) => {
      const jsons = await Promise.all(files.map((file) => readFileAsText(file)));
      await mergeResultsIntoProject(targetProjectId, jsons);
    },
    [mergeResultsIntoProject],
  );

  const handleClearResults = useCallback(
    async (targetProjectId: string) => {
      await clearResultsForProject(targetProjectId);
    },
    [clearResultsForProject],
  );

  const handleExportYaml = useCallback(async (targetProjectId: string) => {
    const snapshot = await getProjectSnapshot(targetProjectId);
    if (!snapshot) throw new Error(t("project.notFound"));
    downloadText(serializeTestsYaml(snapshot.definition), "tests.yml", "text/yaml");
  }, [getProjectSnapshot, t]);

  const handleExportResults = useCallback(async (targetProjectId: string) => {
    const snapshot = await getProjectSnapshot(targetProjectId);
    if (!snapshot) throw new Error(t("project.notFound"));
    downloadText(serializeResultsJson(snapshot.results), "results.json", "application/json");
  }, [getProjectSnapshot, t]);

  const handleExportZip = useCallback(async (targetProjectId: string) => {
    const snapshot = await getProjectSnapshot(targetProjectId);
    if (!snapshot) throw new Error(t("project.notFound"));
    const archive = packProjectArchive({
      testsYaml: serializeTestsYaml(snapshot.definition),
      resultsJson: serializeResultsJson(snapshot.results ?? createEmptyResults(targetProjectId)),
    });
    downloadBlob(projectArchiveToBlob(archive), projectArchiveFilename(targetProjectId));
  }, [getProjectSnapshot, t]);

  const handleDelete = useCallback(
    async (targetProjectId: string) => {
      await deleteProject(targetProjectId);
      const remaining = projectSummaries.filter((summary) => summary.id !== targetProjectId);
      const nextSelection =
        remaining.length === 0
          ? NEW_PROJECT_SELECTION
          : sortProjectSummaries(remaining)[0].id;
      void setProjectId(nextSelection);
    },
    [deleteProject, projectSummaries, setProjectId],
  );

  if (!ready) return null;

  const isNewSelected = projectId === NEW_PROJECT_SELECTION;

  return (
    <div className="flex h-svh flex-col overflow-hidden">
      <header className="shrink-0 border-b px-5 py-4">
        <div className="mx-auto w-full max-w-6xl">
          <h1 className="mb-1 text-2xl font-bold tracking-tight">{t("project.title")}</h1>
          <p className="text-sm text-muted-foreground">{t("project.descriptionLocal")}</p>
        </div>
      </header>

      <main className="flex min-h-0 flex-1 flex-col overflow-hidden px-5 py-4">
        <div className="mx-auto flex min-h-0 w-full max-w-6xl flex-1 flex-col gap-4 md:flex-row md:items-stretch">
          <ProjectList />
          <div className="flex min-h-0 min-w-0 flex-1 flex-col">
            <div className="flex h-full min-h-0 w-full flex-col">
              <div className="flex min-h-0 flex-1 justify-start">
                <div className="h-full w-full min-h-0 max-w-2xl">
                  <RunnerCardTransition slideKey={projectId ?? "pending"}>
                    {isNewSelected ? (
                      <ProjectImportPanel />
                    ) : selectedSummary ? (
                      <ProjectDetailPanel
                        projectId={selectedSummary.id}
                        name={selectedSummary.name}
                        updatedAt={selectedSummary.updatedAt}
                        hasValidSession={selectedSummary.hasValidSession ?? false}
                        isLastOpened={selectedSummary.id === lastOpenedProjectId}
                        onContinue={() =>
                          void handleContinue(
                            selectedSummary.id,
                            selectedSummary.hasValidSession ?? false,
                          )
                        }
                        onMerge={(files) => handleMerge(selectedSummary.id, files)}
                        onClearResults={() => handleClearResults(selectedSummary.id)}
                        onExportYaml={() => handleExportYaml(selectedSummary.id)}
                        onExportResults={() => handleExportResults(selectedSummary.id)}
                        onExportZip={() => handleExportZip(selectedSummary.id)}
                        onDelete={() => handleDelete(selectedSummary.id)}
                      />
                    ) : null}
                  </RunnerCardTransition>
                </div>
              </div>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}

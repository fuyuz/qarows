import { useCallback, useEffect, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import {
  serializeResultsJson,
  serializeTestsYaml,
} from "@qarows/shared";
import { ProjectDetailPanel } from "@/components/ProjectDetailPanel";
import { ProjectImportPanel } from "@/components/ProjectImportPanel";
import { ProjectList } from "@/components/ProjectList";
import { RunnerCardTransition } from "@/components/RunnerCardTransition";
import { useApp } from "@/context/AppContext";
import { useProjectsQueryState } from "@/hooks/useProjectsQueryState";
import { NEW_PROJECT_SELECTION, projectPath } from "@/lib/project-routes";
import { sortProjectSummaries } from "@/lib/project-summaries";
import { getProject } from "@/lib/storage";
import { readFileAsText, downloadText } from "@/lib/utils";

function resolveDefaultSelection(
  summaries: ReturnType<typeof useApp>["projectSummaries"],
  lastOpenedProjectId: string | null,
): string {
  if (summaries.length === 0) return NEW_PROJECT_SELECTION;
  if (lastOpenedProjectId && summaries.some((summary) => summary.projectId === lastOpenedProjectId)) {
    return lastOpenedProjectId;
  }
  return sortProjectSummaries(summaries)[0].projectId;
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
    const exists = projectSummaries.some((summary) => summary.projectId === projectId);
    if (!exists) {
      void setProjectId(defaultSelection);
    }
  }, [ready, projectId, projectSummaries, defaultSelection, setProjectId]);

  const selectedSummary = useMemo(() => {
    if (!projectId || projectId === NEW_PROJECT_SELECTION) return null;
    return projectSummaries.find((summary) => summary.projectId === projectId) ?? null;
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
    const record = await getProject(targetProjectId);
    if (!record) throw new Error("プロジェクトが見つかりません");
    downloadText(serializeTestsYaml(record.definition), "tests.yml", "text/yaml");
  }, []);

  const handleExportResults = useCallback(async (targetProjectId: string) => {
    const record = await getProject(targetProjectId);
    if (!record) throw new Error("プロジェクトが見つかりません");
    downloadText(serializeResultsJson(record.results), "results.json", "application/json");
  }, []);

  const handleDelete = useCallback(
    async (targetProjectId: string) => {
      await deleteProject(targetProjectId);
      const remaining = projectSummaries.filter((summary) => summary.projectId !== targetProjectId);
      const nextSelection =
        remaining.length === 0
          ? NEW_PROJECT_SELECTION
          : sortProjectSummaries(remaining)[0].projectId;
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
          <h1 className="mb-1 text-2xl font-bold tracking-tight">プロジェクト</h1>
          <p className="text-sm text-muted-foreground">
            登録済みの tests.yml を切り替えて作業できます
          </p>
        </div>
      </header>

      <main className="flex min-h-0 flex-1 flex-col overflow-hidden px-5 py-4">
        <div className="mx-auto flex min-h-0 w-full max-w-6xl flex-1 flex-col gap-4 md:flex-row md:items-stretch">
          <ProjectList />
          <div className="flex min-h-0 min-w-0 flex-1 flex-col">
            <div className="flex h-full min-h-0 w-full flex-col">
              <div className="flex min-h-0 flex-1 justify-center">
                <div className="h-full w-full min-h-0 max-w-2xl">
                  <RunnerCardTransition slideKey={projectId ?? "pending"}>
                    {isNewSelected ? (
                      <ProjectImportPanel />
                    ) : selectedSummary ? (
                      <ProjectDetailPanel
                        projectId={selectedSummary.projectId}
                        name={selectedSummary.name}
                        updatedAt={selectedSummary.updatedAt}
                        hasValidSession={selectedSummary.hasValidSession}
                        isLastOpened={selectedSummary.projectId === lastOpenedProjectId}
                        onContinue={() =>
                          void handleContinue(
                            selectedSummary.projectId,
                            selectedSummary.hasValidSession,
                          )
                        }
                        onMerge={(files) => handleMerge(selectedSummary.projectId, files)}
                        onClearResults={() => handleClearResults(selectedSummary.projectId)}
                        onExportYaml={() => handleExportYaml(selectedSummary.projectId)}
                        onExportResults={() => handleExportResults(selectedSummary.projectId)}
                        onDelete={() => handleDelete(selectedSummary.projectId)}
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

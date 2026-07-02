import { useCallback, useEffect, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { Alert, AlertDescription, LoadingScreen } from "@qarows/ui";
import { ProjectDetailPanel } from "@/components/ProjectDetailPanel";
import { ProjectImportPanel } from "@/components/ProjectImportPanel";
import { ProjectList } from "@/components/ProjectList";
import { RunnerCardTransition } from "@/components/RunnerCardTransition";
import { useProjects } from "@/context/ProjectsContext";
import { useProjectsQueryState } from "@/hooks/useProjectsQueryState";
import { NEW_PROJECT_SELECTION, projectPath } from "@/lib/project-routes";
import { readFileAsText } from "@/lib/file-utils";
import { sortProjectSummaries } from "@/lib/project-summaries";

function resolveDefaultSelection(
  summaries: ReturnType<typeof useProjects>["projectSummaries"],
  lastOpenedProjectId: string | null,
): string {
  if (summaries.length === 0) return NEW_PROJECT_SELECTION;
  if (lastOpenedProjectId && summaries.some((summary) => summary.id === lastOpenedProjectId)) {
    return lastOpenedProjectId;
  }
  return sortProjectSummaries(summaries)[0].id;
}

export function ProjectsPage() {
  const navigate = useNavigate();
  const {
    ready,
    loading,
    error,
    projectSummaries,
    lastOpenedProjectId,
    recomputeSessionState,
    removeProject,
    clearProjectResults,
    mergeResultsIntoProject,
    markProjectOpened,
  } = useProjects();
  const { projectId, setProjectId } = useProjectsQueryState();

  const defaultSelection = useMemo(
    () => resolveDefaultSelection(projectSummaries, lastOpenedProjectId),
    [projectSummaries, lastOpenedProjectId],
  );

  useEffect(() => {
    recomputeSessionState();
  }, [recomputeSessionState]);

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
    (targetProjectId: string, hasValidSession: boolean) => {
      markProjectOpened(targetProjectId);
      navigate(projectPath(targetProjectId, hasValidSession ? "run" : "session"));
    },
    [markProjectOpened, navigate],
  );

  const handleMerge = useCallback(
    async (targetProjectId: string, files: File[], expectedGeneration: string) => {
      const jsons = await Promise.all(files.map((file) => readFileAsText(file)));
      await mergeResultsIntoProject(targetProjectId, jsons, expectedGeneration);
    },
    [mergeResultsIntoProject],
  );

  const handleClearResults = useCallback(
    async (targetProjectId: string) => {
      await clearProjectResults(targetProjectId);
    },
    [clearProjectResults],
  );

  const handleDelete = useCallback(
    async (targetProjectId: string) => {
      await removeProject(targetProjectId);
      const remaining = projectSummaries.filter((summary) => summary.id !== targetProjectId);
      const nextSelection =
        remaining.length === 0
          ? NEW_PROJECT_SELECTION
          : sortProjectSummaries(remaining)[0].id;
      void setProjectId(nextSelection);
    },
    [removeProject, projectSummaries, setProjectId],
  );

  if (!ready && loading) {
    return <LoadingScreen message="サーバーからプロジェクト一覧を読み込み中…" />;
  }

  const isNewSelected = projectId === NEW_PROJECT_SELECTION;

  return (
    <div className="flex h-svh flex-col overflow-hidden">
      <header className="shrink-0 border-b px-5 py-4">
        <div className="mx-auto w-full max-w-6xl">
          <h1 className="mb-1 text-2xl font-bold tracking-tight">プロジェクト</h1>
          <p className="text-sm text-muted-foreground">
            サーバー上の tests.yml を管理し、チームで同期して作業します
          </p>
        </div>
      </header>

      <main className="flex min-h-0 flex-1 flex-col overflow-hidden px-5 py-4">
        {error && (
          <Alert variant="destructive" className="mx-auto mb-4 w-full max-w-6xl">
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

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
                        hasValidSession={selectedSummary.hasValidSession}
                        isLastOpened={selectedSummary.id === lastOpenedProjectId}
                        onContinue={() =>
                          handleContinue(selectedSummary.id, selectedSummary.hasValidSession)
                        }
                        onMerge={(files, expectedGeneration) =>
                          handleMerge(selectedSummary.id, files, expectedGeneration)
                        }
                        onClearResults={() => handleClearResults(selectedSummary.id)}
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

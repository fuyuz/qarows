import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import {
  createEmptyProject,
  createProjectFromYaml,
  deleteProject as deleteProjectApi,
  listProjects,
  replaceProjectFromYaml,
  clearProjectResults as clearProjectResultsApi,
  mergeProjectResults as mergeProjectResultsApi,
  type ProjectSummary,
} from "@/lib/api/projects";

const LAST_OPENED_KEY = "qarows-v2:lastOpenedProjectId";

export interface EnrichedProjectSummary extends ProjectSummary {
  hasValidSession?: boolean;
}

interface ProjectsContextValue {
  ready: boolean;
  loading: boolean;
  error: string | null;
  projectSummaries: EnrichedProjectSummary[];
  lastOpenedProjectId: string | null;
  refreshProjects: () => Promise<void>;
  importProject: (testsYaml: string, existingProjectId?: string) => Promise<string>;
  createNamedProject: (name: string) => Promise<string>;
  removeProject: (projectId: string) => Promise<void>;
  clearProjectResults: (projectId: string) => Promise<void>;
  mergeResultsIntoProject: (projectId: string, resultsJsonList: string[]) => Promise<void>;
  markProjectOpened: (projectId: string) => void;
}

const ProjectsContext = createContext<ProjectsContextValue | null>(null);

function readLastOpenedProjectId(): string | null {
  try {
    return localStorage.getItem(LAST_OPENED_KEY);
  } catch {
    return null;
  }
}

function writeLastOpenedProjectId(projectId: string | null): void {
  try {
    if (projectId) localStorage.setItem(LAST_OPENED_KEY, projectId);
    else localStorage.removeItem(LAST_OPENED_KEY);
  } catch {
    // ignore storage errors
  }
}

export function ProjectsProvider({ children }: { children: ReactNode }) {
  const [ready, setReady] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [projectSummaries, setProjectSummaries] = useState<EnrichedProjectSummary[]>([]);
  const [lastOpenedProjectId, setLastOpenedProjectId] = useState<string | null>(() =>
    readLastOpenedProjectId(),
  );

  const refreshProjects = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const summaries = await listProjects();
      setProjectSummaries(summaries);
    } catch (err) {
      setError(err instanceof Error ? err.message : "プロジェクト一覧の取得に失敗しました");
    } finally {
      setLoading(false);
      setReady(true);
    }
  }, []);

  useEffect(() => {
    void refreshProjects();
  }, [refreshProjects]);

  const importProject = useCallback(
    async (testsYaml: string, existingProjectId?: string) => {
      const snapshot = existingProjectId
        ? await replaceProjectFromYaml(existingProjectId, testsYaml)
        : await createProjectFromYaml(testsYaml);
      await refreshProjects();
      writeLastOpenedProjectId(snapshot.id);
      setLastOpenedProjectId(snapshot.id);
      return snapshot.id;
    },
    [refreshProjects],
  );

  const createNamedProject = useCallback(
    async (name: string) => {
      const snapshot = await createEmptyProject(name);
      await refreshProjects();
      writeLastOpenedProjectId(snapshot.id);
      setLastOpenedProjectId(snapshot.id);
      return snapshot.id;
    },
    [refreshProjects],
  );

  const removeProject = useCallback(
    async (projectId: string) => {
      await deleteProjectApi(projectId);
      if (lastOpenedProjectId === projectId) {
        writeLastOpenedProjectId(null);
        setLastOpenedProjectId(null);
      }
      await refreshProjects();
    },
    [lastOpenedProjectId, refreshProjects],
  );

  const clearProjectResults = useCallback(
    async (projectId: string) => {
      await clearProjectResultsApi(projectId);
      await refreshProjects();
    },
    [refreshProjects],
  );

  const mergeResultsIntoProject = useCallback(
    async (projectId: string, resultsJsonList: string[]) => {
      if (resultsJsonList.length === 0) return;
      await mergeProjectResultsApi(projectId, resultsJsonList);
      await refreshProjects();
    },
    [refreshProjects],
  );

  const markProjectOpened = useCallback((projectId: string) => {
    writeLastOpenedProjectId(projectId);
    setLastOpenedProjectId(projectId);
  }, []);

  const value = useMemo<ProjectsContextValue>(
    () => ({
      ready,
      loading,
      error,
      projectSummaries,
      lastOpenedProjectId,
      refreshProjects,
      importProject,
      createNamedProject,
      removeProject,
      clearProjectResults,
      mergeResultsIntoProject,
      markProjectOpened,
    }),
    [
      ready,
      loading,
      error,
      projectSummaries,
      lastOpenedProjectId,
      refreshProjects,
      importProject,
      createNamedProject,
      removeProject,
      clearProjectResults,
      mergeResultsIntoProject,
      markProjectOpened,
    ],
  );

  return <ProjectsContext.Provider value={value}>{children}</ProjectsContext.Provider>;
}

export function useProjects(): ProjectsContextValue {
  const context = useContext(ProjectsContext);
  if (!context) {
    throw new Error("useProjects must be used within ProjectsProvider");
  }
  return context;
}

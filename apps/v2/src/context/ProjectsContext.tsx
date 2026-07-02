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
import { clearLocalSelectedEnvironmentIds } from "@/lib/local-session";
import { enrichSummariesWithSession } from "@/lib/project-session";
import { getSyncUser } from "@/lib/sync/sync-user";

const LAST_OPENED_KEY = "qarows-v2:lastOpenedProjectId";

export interface EnrichedProjectSummary extends ProjectSummary {
  hasValidSession: boolean;
}

interface ProjectsContextValue {
  ready: boolean;
  loading: boolean;
  error: string | null;
  userEmail: string | null;
  projectSummaries: EnrichedProjectSummary[];
  lastOpenedProjectId: string | null;
  refreshProjects: () => Promise<void>;
  recomputeSessionState: () => void;
  importProject: (
    testsYaml: string,
    options?: { existingProjectId?: string; resultsJsonList?: string[] },
  ) => Promise<string>;
  createNamedProject: (name: string) => Promise<string>;
  removeProject: (projectId: string) => Promise<void>;
  clearProjectResults: (projectId: string) => Promise<void>;
  mergeResultsIntoProject: (
    projectId: string,
    resultsJsonList: string[],
    expectedGeneration: string,
  ) => Promise<void>;
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
  const [rawProjectSummaries, setRawProjectSummaries] = useState<ProjectSummary[]>([]);
  const [userEmail, setUserEmail] = useState<string | null>(null);
  const [sessionRevision, setSessionRevision] = useState(0);
  const [lastOpenedProjectId, setLastOpenedProjectId] = useState<string | null>(() =>
    readLastOpenedProjectId(),
  );

  const recomputeSessionState = useCallback(() => {
    setSessionRevision((revision) => revision + 1);
  }, []);

  const projectSummaries = useMemo(
    () => enrichSummariesWithSession(rawProjectSummaries, userEmail),
    [rawProjectSummaries, userEmail, sessionRevision],
  );

  const refreshProjects = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [summaries, email] = await Promise.all([
        listProjects(),
        getSyncUser().catch(() => null),
      ]);
      setRawProjectSummaries(summaries);
      setUserEmail(email);
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
    async (
      testsYaml: string,
      options?: { existingProjectId?: string; resultsJsonList?: string[] },
    ) => {
      const { existingProjectId, resultsJsonList } = options ?? {};
      const snapshot = existingProjectId
        ? await replaceProjectFromYaml(existingProjectId, testsYaml, resultsJsonList)
        : await createProjectFromYaml(testsYaml, resultsJsonList);
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
      if (userEmail) {
        clearLocalSelectedEnvironmentIds(projectId, userEmail);
      }
      recomputeSessionState();
      await refreshProjects();
    },
    [refreshProjects, recomputeSessionState, userEmail],
  );

  const mergeResultsIntoProject = useCallback(
    async (projectId: string, resultsJsonList: string[], expectedGeneration: string) => {
      if (resultsJsonList.length === 0) return;
      await mergeProjectResultsApi(projectId, resultsJsonList, expectedGeneration);
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
      userEmail,
      projectSummaries,
      lastOpenedProjectId,
      refreshProjects,
      recomputeSessionState,
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
      userEmail,
      projectSummaries,
      lastOpenedProjectId,
      refreshProjects,
      recomputeSessionState,
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

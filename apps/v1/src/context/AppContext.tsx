import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import {
  applyProjectCommand,
  toProjectSnapshot,
  type ProjectCommand,
  type ProjectEvent,
  type ProjectSummary as ApplicationProjectSummary,
} from "@qarows/application";
import {
  createEmptyResults,
  getProjectIdFromDefinition,
  parseResultsJson,
  parseTestsYaml,
  type Bug,
  type ResultsFile,
  type SessionConfig,
  type TestCase,
  type TestDefinition,
  type TestResultEntry,
  type TestStatus,
} from "@qarows/shared";
import { getAppMeta, getProject, saveAppMeta, type ProjectSummary } from "@/lib/storage";
import { sortProjectSummaries } from "@/lib/project-summaries";
import { createPhase1WorkspaceController } from "@/lib/adapters/create-phase1-workspace";
import { IndexedDbProjectRepository } from "@/lib/adapters/indexed-db-project-repository";

interface AppContextValue {
  ready: boolean;
  definition: TestDefinition | null;
  results: ResultsFile | null;
  session: SessionConfig | null;
  lastUpdatedTestId: string | null;
  activeProjectId: string | null;
  projectSummaries: ProjectSummary[];
  lastOpenedProjectId: string | null;
  loadProject: (yaml: string, resultsJson?: string) => Promise<string>;
  activateProject: (projectId: string) => Promise<boolean>;
  hasProject: (projectId: string) => Promise<boolean>;
  mergeResultsFromFile: (json: string) => Promise<void>;
  mergeResultsFromFiles: (jsons: string[]) => Promise<void>;
  mergeResultsIntoProject: (projectId: string, jsons: string[]) => Promise<boolean>;
  setSession: (session: SessionConfig) => Promise<void>;
  updateResults: (
    testCaseId: string,
    envId: string,
    entry: TestResultEntry,
  ) => Promise<void>;
  updateResultsBatch: (
    testCaseId: string,
    envIds: string[],
    partial: Pick<TestResultEntry, "status" | "memo"> & { status: TestStatus },
  ) => Promise<void>;
  addBug: (bug: Bug) => Promise<void>;
  updateBug: (bug: Bug) => Promise<void>;
  updateTestCase: (
    testCaseId: string,
    patch: Partial<Pick<TestCase, "category" | "prerequisites" | "description" | "version">>,
  ) => Promise<void>;
  clearTestResult: (testCaseId: string, envId: string) => Promise<void>;
  clearResults: () => Promise<void>;
  clearResultsForProject: (projectId: string) => Promise<boolean>;
  deleteProject: (projectId: string) => Promise<void>;
  refreshProjectSummaries: () => Promise<void>;
}

const AppContext = createContext<AppContextValue | null>(null);

function toV1Summary(summary: ApplicationProjectSummary): ProjectSummary {
  return {
    projectId: summary.id,
    name: summary.name,
    updatedAt: summary.updatedAt,
    hasValidSession: summary.hasValidSession ?? false,
  };
}

function affectedTestCaseFromCommand(command: ProjectCommand): string | null {
  switch (command.type) {
    case "updateResult":
    case "updateResultsBatch":
    case "clearTestResult":
    case "updateTestCase":
      return command.testCaseId;
    case "addBug":
    case "updateBug":
      return command.bug.testCaseId ?? null;
    default:
      return null;
  }
}

export function AppProvider({ children }: { children: ReactNode }) {
  const workspaceRef = useRef(createPhase1WorkspaceController());
  const repositoryRef = useRef(new IndexedDbProjectRepository());

  const [ready, setReady] = useState(false);
  const [definition, setDefinition] = useState<TestDefinition | null>(null);
  const [results, setResults] = useState<ResultsFile | null>(null);
  const [session, setSessionState] = useState<SessionConfig | null>(null);
  const [lastUpdatedTestId, setLastUpdatedTestId] = useState<string | null>(null);
  const [activeProjectId, setActiveProjectId] = useState<string | null>(null);
  const [projectSummaries, setProjectSummaries] = useState<ProjectSummary[]>([]);
  const [lastOpenedProjectId, setLastOpenedProjectId] = useState<string | null>(null);
  const highlightClearTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const definitionRef = useRef<TestDefinition | null>(null);
  const resultsRef = useRef<ResultsFile | null>(null);
  const sessionRef = useRef<SessionConfig | null>(null);

  const markTestUpdated = useCallback((testCaseId: string) => {
    setLastUpdatedTestId(testCaseId);
    if (highlightClearTimerRef.current) clearTimeout(highlightClearTimerRef.current);
    highlightClearTimerRef.current = setTimeout(() => setLastUpdatedTestId(null), 600);
  }, []);

  useEffect(() => {
    return () => {
      if (highlightClearTimerRef.current) clearTimeout(highlightClearTimerRef.current);
    };
  }, []);

  const applySnapshotToState = useCallback((snapshot: {
    id: string;
    definition: TestDefinition;
    results: ResultsFile;
    session: SessionConfig | null;
  }) => {
    setActiveProjectId(snapshot.id);
    definitionRef.current = snapshot.definition;
    resultsRef.current = snapshot.results;
    sessionRef.current = snapshot.session;
    setDefinition(snapshot.definition);
    setResults(snapshot.results);
    setSessionState(snapshot.session);
  }, []);

  const clearActiveSnapshot = useCallback(() => {
    definitionRef.current = null;
    resultsRef.current = null;
    sessionRef.current = null;
    setActiveProjectId(null);
    setDefinition(null);
    setResults(null);
    setSessionState(null);
    setLastUpdatedTestId(null);
  }, []);

  const refreshProjectSummaries = useCallback(async () => {
    const summaries = await workspaceRef.current.listSummaries();
    setProjectSummaries(sortProjectSummaries(summaries.map(toV1Summary)));
  }, []);

  useEffect(() => {
    const handleEvent = (event: ProjectEvent) => {
      switch (event.type) {
        case "snapshot":
        case "commandApplied":
          applySnapshotToState(event.snapshot);
          if (event.type === "commandApplied") {
            const affected = affectedTestCaseFromCommand(event.command);
            if (affected) markTestUpdated(affected);
          }
          void refreshProjectSummaries();
          return;
        case "error":
          console.error(event.message);
          return;
      }
    };

    const unsubscribe = workspaceRef.current.subscribe(handleEvent);
    void (async () => {
      const meta = await getAppMeta();
      setLastOpenedProjectId(meta.lastOpenedProjectId);
      await refreshProjectSummaries();
      setReady(true);
    })();

    return unsubscribe;
  }, [applySnapshotToState, markTestUpdated, refreshProjectSummaries]);

  const dispatch = useCallback(
    async (command: ProjectCommand) => {
      await workspaceRef.current.dispatch(command);
    },
    [],
  );

  const activateProject = useCallback(
    async (projectId: string): Promise<boolean> => {
      setLastUpdatedTestId(null);
      const activated = await workspaceRef.current.activateProject(projectId);
      if (!activated) return false;
      const snapshot = workspaceRef.current.getSnapshot();
      if (snapshot) applySnapshotToState(snapshot);
      setLastOpenedProjectId(projectId);
      await saveAppMeta({ lastOpenedProjectId: projectId });
      return true;
    },
    [applySnapshotToState],
  );

  const checkHasProject = useCallback(async (projectId: string): Promise<boolean> => {
    return workspaceRef.current.hasProject(projectId);
  }, []);

  const loadProject = useCallback(async (yaml: string, resultsJson?: string) => {
    const parsedDefinition = parseTestsYaml(yaml);
    const projectId = getProjectIdFromDefinition(parsedDefinition);
    let parsedResults = createEmptyResults(projectId);
    if (resultsJson) {
      parsedResults = parseResultsJson(resultsJson, { definition: parsedDefinition });
    }

    const snapshot = toProjectSnapshot(projectId, {
      definition: parsedDefinition,
      results: parsedResults,
      session: null,
      updatedAt: parsedResults.updatedAt,
    });
    await workspaceRef.current.saveSnapshot(snapshot);
    await refreshProjectSummaries();

    setLastUpdatedTestId(null);
    await activateProject(projectId);
    return projectId;
  }, [activateProject, refreshProjectSummaries]);

  const mergeResultsFromFiles = useCallback(
    async (jsons: string[]) => {
      const currentResults = resultsRef.current;
      if (!currentResults) throw new Error("結果データが読み込まれていません");
      if (jsons.length === 0) return;
      const currentDefinition = definitionRef.current;
      if (!currentDefinition) throw new Error("プロジェクト定義が読み込まれていません");

      let snapshot = workspaceRef.current.getSnapshot()!;
      for (const json of jsons) {
        const incoming = parseResultsJson(json, { definition: currentDefinition });
        snapshot = applyProjectCommand(snapshot, { type: "mergeResults", incoming }).snapshot;
      }
      await dispatch({
        type: "replaceSnapshot",
        definition: snapshot.definition,
        results: snapshot.results,
        session: snapshot.session,
      });
    },
    [dispatch],
  );

  const mergeResultsFromFile = useCallback(
    async (json: string) => {
      await mergeResultsFromFiles([json]);
    },
    [mergeResultsFromFiles],
  );

  const mergeResultsIntoProject = useCallback(
    async (projectId: string, jsons: string[]): Promise<boolean> => {
      if (jsons.length === 0) return true;
      const record = await getProject(projectId);
      if (!record) return false;

      let snapshot = toProjectSnapshot(projectId, record);
      for (const json of jsons) {
        const incoming = parseResultsJson(json, { definition: record.definition });
        snapshot = applyProjectCommand(snapshot, { type: "mergeResults", incoming }).snapshot;
      }
      await repositoryRef.current.saveSnapshot(snapshot);
      await refreshProjectSummaries();

      if (workspaceRef.current.getActiveProjectId() === projectId) {
        await activateProject(projectId);
      }
      return true;
    },
    [activateProject, refreshProjectSummaries],
  );

  const setSession = useCallback(
    async (nextSession: SessionConfig) => {
      await dispatch({ type: "setSession", session: nextSession });
    },
    [dispatch],
  );

  const updateResults = useCallback(
    async (testCaseId: string, envId: string, entry: TestResultEntry) => {
      await dispatch({ type: "updateResult", testCaseId, envId, entry });
    },
    [dispatch],
  );

  const updateResultsBatch = useCallback(
    async (
      testCaseId: string,
      envIds: string[],
      partial: Pick<TestResultEntry, "status" | "memo"> & { status: TestStatus },
    ) => {
      await dispatch({ type: "updateResultsBatch", testCaseId, envIds, partial });
    },
    [dispatch],
  );

  const addBug = useCallback(
    async (bug: Bug) => {
      await dispatch({ type: "addBug", bug });
    },
    [dispatch],
  );

  const updateBug = useCallback(
    async (bug: Bug) => {
      await dispatch({ type: "updateBug", bug });
    },
    [dispatch],
  );

  const updateTestCase = useCallback(
    async (
      testCaseId: string,
      patch: Partial<Pick<TestCase, "category" | "prerequisites" | "description" | "version">>,
    ) => {
      await dispatch({ type: "updateTestCase", testCaseId, patch });
    },
    [dispatch],
  );

  const clearTestResult = useCallback(
    async (testCaseId: string, envId: string) => {
      await dispatch({ type: "clearTestResult", testCaseId, envId });
    },
    [dispatch],
  );

  const clearResults = useCallback(async () => {
    await dispatch({ type: "clearResults" });
  }, [dispatch]);

  const clearResultsForProject = useCallback(
    async (projectId: string): Promise<boolean> => {
      const record = await getProject(projectId);
      if (!record) return false;

      const cleared = applyProjectCommand(toProjectSnapshot(projectId, record), {
        type: "clearResults",
      }).snapshot;
      await repositoryRef.current.saveSnapshot(cleared);
      await refreshProjectSummaries();

      if (workspaceRef.current.getActiveProjectId() === projectId) {
        await activateProject(projectId);
      }
      return true;
    },
    [activateProject, refreshProjectSummaries],
  );

  const deleteProject = useCallback(
    async (projectId: string) => {
      await workspaceRef.current.deleteProject(projectId);
      if (workspaceRef.current.getActiveProjectId() === projectId) {
        clearActiveSnapshot();
      }
      await refreshProjectSummaries();

      const meta = await getAppMeta();
      if (meta.lastOpenedProjectId === projectId) {
        const summaries = await workspaceRef.current.listSummaries();
        const nextLastOpened = summaries[0]?.id ?? null;
        setLastOpenedProjectId(nextLastOpened);
        await saveAppMeta({ lastOpenedProjectId: nextLastOpened });
      }
    },
    [clearActiveSnapshot, refreshProjectSummaries],
  );

  const value = useMemo(
    () => ({
      ready,
      definition,
      results,
      session,
      lastUpdatedTestId,
      activeProjectId,
      projectSummaries,
      lastOpenedProjectId,
      loadProject,
      activateProject,
      hasProject: checkHasProject,
      mergeResultsFromFile,
      mergeResultsFromFiles,
      mergeResultsIntoProject,
      setSession,
      updateResults,
      updateResultsBatch,
      addBug,
      updateBug,
      updateTestCase,
      clearTestResult,
      clearResults,
      clearResultsForProject,
      deleteProject,
      refreshProjectSummaries,
    }),
    [
      ready,
      definition,
      results,
      session,
      lastUpdatedTestId,
      activeProjectId,
      projectSummaries,
      lastOpenedProjectId,
      loadProject,
      activateProject,
      checkHasProject,
      mergeResultsFromFile,
      mergeResultsFromFiles,
      mergeResultsIntoProject,
      setSession,
      updateResults,
      updateResultsBatch,
      addBug,
      updateBug,
      updateTestCase,
      clearTestResult,
      clearResults,
      clearResultsForProject,
      deleteProject,
      refreshProjectSummaries,
    ],
  );

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
}

export function useApp() {
  const ctx = useContext(AppContext);
  if (!ctx) throw new Error("useApp must be used within AppProvider");
  return ctx;
}

export type { ProjectSummary };

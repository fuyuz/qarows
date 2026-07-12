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
  affectedTestCaseFromCommand,
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
import { createLocalWorkspaceController } from "@/lib/adapters/create-local-workspace";
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
  replaceDefinition: (definition: TestDefinition) => Promise<void>;
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

export function AppProvider({ children }: { children: ReactNode }) {
  const workspaceRef = useRef<ReturnType<typeof createLocalWorkspaceController> | null>(null);
  if (workspaceRef.current === null) {
    workspaceRef.current = createLocalWorkspaceController();
  }

  const repositoryRef = useRef<IndexedDbProjectRepository | null>(null);
  if (repositoryRef.current === null) {
    repositoryRef.current = new IndexedDbProjectRepository();
  }
  const workspace = workspaceRef.current;
  const repository = repositoryRef.current;

  const [ready, setReady] = useState(false);
  const [definition, setDefinition] = useState<TestDefinition | null>(null);
  const [results, setResults] = useState<ResultsFile | null>(null);
  const [session, setSessionState] = useState<SessionConfig | null>(null);
  const [lastUpdatedTestId, setLastUpdatedTestId] = useState<string | null>(null);
  const [activeProjectId, setActiveProjectId] = useState<string | null>(null);
  const [projectSummaries, setProjectSummaries] = useState<ProjectSummary[]>([]);
  const [lastOpenedProjectId, setLastOpenedProjectId] = useState<string | null>(null);
  const highlightClearTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

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
    setDefinition(snapshot.definition);
    setResults(snapshot.results);
    setSessionState(snapshot.session);
  }, []);

  const clearActiveSnapshot = useCallback(() => {
    setActiveProjectId(null);
    setDefinition(null);
    setResults(null);
    setSessionState(null);
    setLastUpdatedTestId(null);
  }, []);

  const refreshProjectSummaries = useCallback(async () => {
    const summaries = await workspace.listSummaries();
    setProjectSummaries(sortProjectSummaries(summaries.map(toV1Summary)));
  }, [workspace]);

  useEffect(() => {
    let cancelled = false;

    const handleEvent = (event: ProjectEvent) => {
      if (cancelled) return;
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

    const unsubscribe = workspace.subscribe(handleEvent);
    void (async () => {
      const meta = await getAppMeta();
      if (cancelled) return;
      setLastOpenedProjectId(meta.lastOpenedProjectId);
      await refreshProjectSummaries();
      if (cancelled) return;
      setReady(true);
    })();

    return () => {
      cancelled = true;
      unsubscribe();
    };
  }, [applySnapshotToState, markTestUpdated, refreshProjectSummaries, workspace]);

  const dispatch = useCallback(
    async (command: ProjectCommand) => {
      await workspace.dispatch(command);
    },
    [workspace],
  );

  const activateProject = useCallback(
    async (projectId: string): Promise<boolean> => {
      setLastUpdatedTestId(null);
      const activated = await workspace.activateProject(projectId);
      if (!activated) return false;
      const snapshot = workspace.getSnapshot();
      if (snapshot) applySnapshotToState(snapshot);
      setLastOpenedProjectId(projectId);
      await saveAppMeta({ lastOpenedProjectId: projectId });
      return true;
    },
    [applySnapshotToState, workspace],
  );

  const checkHasProject = useCallback(async (projectId: string): Promise<boolean> => {
    return workspace.hasProject(projectId);
  }, [workspace]);

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
    await workspace.saveSnapshot(snapshot);
    await refreshProjectSummaries();

    setLastUpdatedTestId(null);
    await activateProject(projectId);
    return projectId;
  }, [activateProject, refreshProjectSummaries, workspace]);

  const mergeResultsFromFiles = useCallback(
    async (jsons: string[]) => {
      let snapshot = workspace.getSnapshot();
      if (!snapshot) throw new Error("結果データが読み込まれていません");
      if (jsons.length === 0) return;

      const currentDefinition = snapshot.definition;
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
    [dispatch, workspace],
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
      await repository.saveSnapshot(snapshot);
      await refreshProjectSummaries();

      if (workspace.getActiveProjectId() === projectId) {
        await activateProject(projectId);
      }
      return true;
    },
    [activateProject, refreshProjectSummaries, repository, workspace],
  );

  /** dispatch は安定なので、コマンドを組むだけの API はまとめて一度だけ作る */
  const commands = useMemo(
    () => ({
      setSession: (nextSession: SessionConfig) =>
        dispatch({ type: "setSession", session: nextSession }),
      updateResults: (testCaseId: string, envId: string, entry: TestResultEntry) =>
        dispatch({ type: "updateResult", testCaseId, envId, entry }),
      updateResultsBatch: (
        testCaseId: string,
        envIds: string[],
        partial: Pick<TestResultEntry, "status" | "memo"> & { status: TestStatus },
      ) => dispatch({ type: "updateResultsBatch", testCaseId, envIds, partial }),
      addBug: (bug: Bug) => dispatch({ type: "addBug", bug }),
      updateBug: (bug: Bug) => dispatch({ type: "updateBug", bug }),
      updateTestCase: (
        testCaseId: string,
        patch: Partial<Pick<TestCase, "category" | "prerequisites" | "description" | "version">>,
      ) => dispatch({ type: "updateTestCase", testCaseId, patch }),
      replaceDefinition: (nextDefinition: TestDefinition) =>
        dispatch({ type: "replaceDefinition", definition: nextDefinition }),
      clearTestResult: (testCaseId: string, envId: string) =>
        dispatch({ type: "clearTestResult", testCaseId, envId }),
      clearResults: () => dispatch({ type: "clearResults" }),
    }),
    [dispatch],
  );

  const clearResultsForProject = useCallback(
    async (projectId: string): Promise<boolean> => {
      const record = await getProject(projectId);
      if (!record) return false;

      const cleared = applyProjectCommand(toProjectSnapshot(projectId, record), {
        type: "clearResults",
      }).snapshot;
      await repository.saveSnapshot(cleared);
      await refreshProjectSummaries();
      return true;
    },
    [refreshProjectSummaries, repository],
  );

  const deleteProject = useCallback(
    async (projectId: string) => {
      await workspace.deleteProject(projectId);
      if (workspace.getActiveProjectId() === projectId) {
        clearActiveSnapshot();
      }
      await refreshProjectSummaries();

      const meta = await getAppMeta();
      if (meta.lastOpenedProjectId === projectId) {
        const summaries = await workspace.listSummaries();
        const nextLastOpened = summaries[0]?.id ?? null;
        setLastOpenedProjectId(nextLastOpened);
        await saveAppMeta({ lastOpenedProjectId: nextLastOpened });
      }
    },
    [clearActiveSnapshot, refreshProjectSummaries, workspace],
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
      ...commands,
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
      commands,
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

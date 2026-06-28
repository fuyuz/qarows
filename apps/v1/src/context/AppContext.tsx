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
  clearTestCaseEnvironmentResult,
  createEmptyResults,
  getProjectIdFromDefinition,
  getTestCaseVersion,
  mergeResultsFiles,
  parseResultsJson,
  parseTestsYaml,
  validateSession,
  type ResultsFile,
  type SessionConfig,
  type TestCase,
  type TestDefinition,
  type TestResultEntry,
  type TestStatus,
} from "@qarows/shared";
import {
  deleteProjectFromStorage,
  getAppMeta,
  getProject,
  hasProject,
  listProjectSummaries,
  saveAppMeta,
  saveProject,
  type ProjectRecord,
  type ProjectSummary,
} from "@/lib/storage";
import { buildProjectRecord } from "@/lib/project-record";
import { projectRecordToSummary, sortProjectSummaries } from "@/lib/project-summaries";

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
  updateResultsFile: (updater: (prev: ResultsFile) => ResultsFile) => Promise<void>;
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

function useSerialMutationQueue() {
  const tailRef = useRef(Promise.resolve());

  const runSerial = useCallback(<T,>(task: () => Promise<T>): Promise<T> => {
    const run = tailRef.current.then(task);
    tailRef.current = run.then(
      () => undefined,
      () => undefined,
    );
    return run;
  }, []);

  return runSerial;
}

export function AppProvider({ children }: { children: ReactNode }) {
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
  const activeProjectIdRef = useRef<string | null>(null);
  const runSerial = useSerialMutationQueue();

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

  const refreshProjectSummaries = useCallback(async () => {
    const summaries = await listProjectSummaries();
    setProjectSummaries(summaries);
  }, []);

  const upsertProjectSummary = useCallback((projectId: string, record: ProjectRecord) => {
    const summary = projectRecordToSummary(projectId, record);
    setProjectSummaries((prev) => {
      const rest = prev.filter((entry) => entry.projectId !== projectId);
      return sortProjectSummaries([...rest, summary]);
    });
  }, []);

  useEffect(() => {
    void (async () => {
      const [summaries, meta] = await Promise.all([listProjectSummaries(), getAppMeta()]);
      setProjectSummaries(summaries);
      setLastOpenedProjectId(meta.lastOpenedProjectId);
      setReady(true);
    })();
  }, []);

  const applyActiveSnapshot = useCallback(
    (
      projectId: string | null,
      next: {
        definition?: TestDefinition | null;
        results?: ResultsFile | null;
        session?: SessionConfig | null;
      },
    ) => {
      activeProjectIdRef.current = projectId;
      setActiveProjectId(projectId);

      const snapshot = {
        definition: next.definition !== undefined ? next.definition : definitionRef.current,
        results: next.results !== undefined ? next.results : resultsRef.current,
        session: next.session !== undefined ? next.session : sessionRef.current,
      };

      if (next.definition !== undefined) {
        definitionRef.current = next.definition;
        setDefinition(next.definition);
      }
      if (next.results !== undefined) {
        resultsRef.current = next.results;
        setResults(next.results);
      }
      if (next.session !== undefined) {
        sessionRef.current = next.session;
        setSessionState(next.session);
      }

      return snapshot;
    },
    [],
  );

  const clearActiveSnapshot = useCallback(() => {
    activeProjectIdRef.current = null;
    setActiveProjectId(null);
    definitionRef.current = null;
    resultsRef.current = null;
    sessionRef.current = null;
    setDefinition(null);
    setResults(null);
    setSessionState(null);
    setLastUpdatedTestId(null);
  }, []);

  const saveProjectRecord = useCallback(
    async (
      projectId: string,
      record: ProjectRecord,
      options?: { syncActiveIfMatches?: boolean },
    ) => {
      await saveProject(projectId, record);
      upsertProjectSummary(projectId, record);
      if (options?.syncActiveIfMatches && activeProjectIdRef.current === projectId) {
        applyActiveSnapshot(projectId, {
          definition: record.definition,
          results: record.results,
          session: record.session,
        });
      }
    },
    [applyActiveSnapshot, upsertProjectSummary],
  );

  const persistActive = useCallback(
    async (next: {
      definition?: TestDefinition | null;
      results?: ResultsFile | null;
      session?: SessionConfig | null;
    }) => {
      const projectId = activeProjectIdRef.current;
      if (!projectId) return;

      const snapshot = applyActiveSnapshot(projectId, next);
      if (!snapshot.definition || !snapshot.results) return;

      const record = buildProjectRecord({
        definition: snapshot.definition,
        results: snapshot.results,
        session: snapshot.session,
      });
      await saveProjectRecord(projectId, record);
    },
    [applyActiveSnapshot, saveProjectRecord],
  );

  const activateProject = useCallback(
    async (projectId: string): Promise<boolean> => {
      return runSerial(async () => {
        const record = await getProject(projectId);
        if (!record) return false;

        setLastUpdatedTestId(null);
        applyActiveSnapshot(projectId, {
          definition: record.definition,
          results: record.results,
          session: record.session,
        });

        setLastOpenedProjectId(projectId);
        await saveAppMeta({ lastOpenedProjectId: projectId });
        return true;
      });
    },
    [applyActiveSnapshot, runSerial],
  );

  const checkHasProject = useCallback(async (projectId: string): Promise<boolean> => {
    return hasProject(projectId);
  }, []);

  const stampResultVersion = useCallback(
    (testCaseId: string, entry: TestResultEntry): TestResultEntry => {
      const testCase = definitionRef.current?.testCases.find((tc) => tc.id === testCaseId);
      if (!testCase) return entry;
      const version = getTestCaseVersion(testCase);
      return version > 1 ? { ...entry, version } : entry;
    },
    [],
  );

  const loadProject = useCallback(
    async (yaml: string, resultsJson?: string) => {
      return runSerial(async () => {
        const parsedDefinition = parseTestsYaml(yaml);
        const projectId = getProjectIdFromDefinition(parsedDefinition);
        let parsedResults = createEmptyResults(projectId);
        if (resultsJson) {
          parsedResults = parseResultsJson(resultsJson, { definition: parsedDefinition });
        }

        const record = buildProjectRecord({
          definition: parsedDefinition,
          results: parsedResults,
          session: null,
        });
        await saveProjectRecord(projectId, record);

        setLastUpdatedTestId(null);
        applyActiveSnapshot(projectId, {
          definition: parsedDefinition,
          results: parsedResults,
          session: null,
        });

        setLastOpenedProjectId(projectId);
        await saveAppMeta({ lastOpenedProjectId: projectId });
        return projectId;
      });
    },
    [applyActiveSnapshot, runSerial, saveProjectRecord],
  );

  const mergeResultsFromFiles = useCallback(
    async (jsons: string[]) => {
      await runSerial(async () => {
        const currentResults = resultsRef.current;
        if (!currentResults) throw new Error("結果データが読み込まれていません");
        if (jsons.length === 0) return;
        let merged = currentResults;
        const currentDefinition = definitionRef.current;
        if (!currentDefinition) throw new Error("プロジェクト定義が読み込まれていません");
        for (const json of jsons) {
          const incoming = parseResultsJson(json, { definition: currentDefinition });
          merged = mergeResultsFiles(merged, incoming);
        }
        await persistActive({ results: merged });
      });
    },
    [persistActive, runSerial],
  );

  const mergeResultsFromFile = useCallback(
    async (json: string) => {
      await mergeResultsFromFiles([json]);
    },
    [mergeResultsFromFiles],
  );

  const mergeResultsIntoProject = useCallback(
    async (projectId: string, jsons: string[]): Promise<boolean> => {
      return runSerial(async () => {
        if (jsons.length === 0) return true;
        const record = await getProject(projectId);
        if (!record) return false;

        let merged = record.results;
        for (const json of jsons) {
          const incoming = parseResultsJson(json, { definition: record.definition });
          merged = mergeResultsFiles(merged, incoming);
        }

        const nextRecord = buildProjectRecord({
          definition: record.definition,
          results: merged,
          session: record.session,
        });
        await saveProjectRecord(projectId, nextRecord, { syncActiveIfMatches: true });
        return true;
      });
    },
    [runSerial, saveProjectRecord],
  );

  const setSession = useCallback(
    async (nextSession: SessionConfig) => {
      await runSerial(async () => {
        validateSession(nextSession);
        await persistActive({ session: nextSession });
      });
    },
    [persistActive, runSerial],
  );

  const updateResults = useCallback(
    async (testCaseId: string, envId: string, entry: TestResultEntry) => {
      await runSerial(async () => {
        const currentResults = resultsRef.current;
        if (!currentResults) return;
        const stamped = stampResultVersion(testCaseId, entry);
        const next: ResultsFile = {
          ...currentResults,
          updatedAt: new Date().toISOString(),
          results: {
            ...currentResults.results,
            [testCaseId]: {
              ...(currentResults.results[testCaseId] ?? {}),
              [envId]: stamped,
            },
          },
        };
        await persistActive({ results: next });
        markTestUpdated(testCaseId);
      });
    },
    [markTestUpdated, persistActive, runSerial, stampResultVersion],
  );

  const updateResultsBatch = useCallback(
    async (
      testCaseId: string,
      envIds: string[],
      partial: Pick<TestResultEntry, "status" | "memo"> & { status: TestStatus },
    ) => {
      await runSerial(async () => {
        const currentResults = resultsRef.current;
        const currentSession = sessionRef.current;
        if (!currentResults || !currentSession) return;
        const testCase = definitionRef.current?.testCases.find((tc) => tc.id === testCaseId);
        const version = testCase ? getTestCaseVersion(testCase) : 1;
        const now = new Date().toISOString();
        const caseResults = { ...(currentResults.results[testCaseId] ?? {}) };
        for (const envId of envIds) {
          caseResults[envId] = {
            status: partial.status,
            memo: partial.memo ?? caseResults[envId]?.memo,
            executedAt: now,
            executedBy: currentSession.executorName,
            ...(version > 1 ? { version } : {}),
          };
        }
        const next: ResultsFile = {
          ...currentResults,
          updatedAt: now,
          results: {
            ...currentResults.results,
            [testCaseId]: caseResults,
          },
        };
        await persistActive({ results: next });
        markTestUpdated(testCaseId);
      });
    },
    [markTestUpdated, persistActive, runSerial],
  );

  const updateResultsFile = useCallback(
    async (updater: (prev: ResultsFile) => ResultsFile) => {
      await runSerial(async () => {
        const currentResults = resultsRef.current;
        if (!currentResults) return;
        const next = updater(currentResults);
        await persistActive({
          results: { ...next, updatedAt: new Date().toISOString() },
        });
      });
    },
    [persistActive, runSerial],
  );

  const updateTestCase = useCallback(
    async (
      testCaseId: string,
      patch: Partial<Pick<TestCase, "category" | "prerequisites" | "description" | "version">>,
    ) => {
      await runSerial(async () => {
        const currentDefinition = definitionRef.current;
        if (!currentDefinition) return;
        const nextDefinition: TestDefinition = {
          ...currentDefinition,
          testCases: currentDefinition.testCases.map((tc) =>
            tc.id === testCaseId ? { ...tc, ...patch } : tc,
          ),
        };
        await persistActive({ definition: nextDefinition });
        markTestUpdated(testCaseId);
      });
    },
    [markTestUpdated, persistActive, runSerial],
  );

  const clearTestResult = useCallback(
    async (testCaseId: string, envId: string) => {
      await runSerial(async () => {
        const currentResults = resultsRef.current;
        if (!currentResults) return;
        const next = clearTestCaseEnvironmentResult(currentResults, testCaseId, envId);
        if (next === currentResults) return;
        await persistActive({ results: next });
        markTestUpdated(testCaseId);
      });
    },
    [markTestUpdated, persistActive, runSerial],
  );

  const clearResults = useCallback(async () => {
    await runSerial(async () => {
      const currentDefinition = definitionRef.current;
      if (!currentDefinition) return;
      const projectId = getProjectIdFromDefinition(currentDefinition);
      await persistActive({
        results: createEmptyResults(projectId),
        session: null,
      });
    });
  }, [persistActive, runSerial]);

  const clearResultsForProject = useCallback(
    async (projectId: string): Promise<boolean> => {
      return runSerial(async () => {
        const record = await getProject(projectId);
        if (!record) return false;

        const nextRecord = buildProjectRecord({
          definition: record.definition,
          results: createEmptyResults(projectId),
          session: null,
        });
        await saveProjectRecord(projectId, nextRecord, { syncActiveIfMatches: true });
        return true;
      });
    },
    [runSerial, saveProjectRecord],
  );

  const deleteProject = useCallback(
    async (projectId: string) => {
      await runSerial(async () => {
        await deleteProjectFromStorage(projectId);

        if (activeProjectIdRef.current === projectId) {
          clearActiveSnapshot();
        }

        const sortedRemaining = await listProjectSummaries();
        setProjectSummaries(sortedRemaining);

        const meta = await getAppMeta();
        if (meta.lastOpenedProjectId === projectId) {
          const nextLastOpened = sortedRemaining[0]?.projectId ?? null;
          setLastOpenedProjectId(nextLastOpened);
          await saveAppMeta({ lastOpenedProjectId: nextLastOpened });
        }
      });
    },
    [clearActiveSnapshot, runSerial],
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
      updateResultsFile,
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
      updateResultsFile,
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

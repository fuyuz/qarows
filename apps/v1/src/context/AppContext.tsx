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
import { clearState, loadState, saveState } from "@/lib/storage";

interface AppContextValue {
  ready: boolean;
  definition: TestDefinition | null;
  results: ResultsFile | null;
  session: SessionConfig | null;
  lastUpdatedTestId: string | null;
  loadProject: (yaml: string, resultsJson?: string) => Promise<string>;
  mergeResultsFromFile: (json: string) => Promise<void>;
  mergeResultsFromFiles: (jsons: string[]) => Promise<void>;
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
  resetProject: () => Promise<void>;
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
  const highlightClearTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const definitionRef = useRef<TestDefinition | null>(null);
  const resultsRef = useRef<ResultsFile | null>(null);
  const sessionRef = useRef<SessionConfig | null>(null);
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

  useEffect(() => {
    void loadState().then((state) => {
      definitionRef.current = state.definition;
      resultsRef.current = state.results;
      sessionRef.current = state.session;
      setDefinition(state.definition);
      setResults(state.results);
      setSessionState(state.session);
      setReady(true);
    });
  }, []);

  const applySnapshot = useCallback(
    (next: {
      definition?: TestDefinition | null;
      results?: ResultsFile | null;
      session?: SessionConfig | null;
    }) => {
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

  const persist = useCallback(
    async (next: {
      definition?: TestDefinition | null;
      results?: ResultsFile | null;
      session?: SessionConfig | null;
    }) => {
      const snapshot = applySnapshot(next);
      await saveState(snapshot);
    },
    [applySnapshot],
  );

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
        const projectId = parsedDefinition.project.id ?? "project";
        let parsedResults = createEmptyResults(projectId);
        if (resultsJson) {
          parsedResults = parseResultsJson(resultsJson, { definition: parsedDefinition });
        }
        await persist({
          definition: parsedDefinition,
          results: parsedResults,
          session: null,
        });
        return projectId;
      });
    },
    [persist, runSerial],
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
        await persist({ results: merged });
      });
    },
    [persist, runSerial],
  );

  const mergeResultsFromFile = useCallback(
    async (json: string) => {
      await mergeResultsFromFiles([json]);
    },
    [mergeResultsFromFiles],
  );

  const setSession = useCallback(
    async (nextSession: SessionConfig) => {
      await runSerial(async () => {
        validateSession(nextSession);
        await persist({ session: nextSession });
      });
    },
    [persist, runSerial],
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
        await persist({ results: next });
        markTestUpdated(testCaseId);
      });
    },
    [markTestUpdated, persist, runSerial, stampResultVersion],
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
        await persist({ results: next });
        markTestUpdated(testCaseId);
      });
    },
    [markTestUpdated, persist, runSerial],
  );

  const updateResultsFile = useCallback(
    async (updater: (prev: ResultsFile) => ResultsFile) => {
      await runSerial(async () => {
        const currentResults = resultsRef.current;
        if (!currentResults) return;
        const next = updater(currentResults);
        await persist({
          results: { ...next, updatedAt: new Date().toISOString() },
        });
      });
    },
    [persist, runSerial],
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
        await persist({ definition: nextDefinition });
        markTestUpdated(testCaseId);
      });
    },
    [markTestUpdated, persist, runSerial],
  );

  const clearTestResult = useCallback(
    async (testCaseId: string, envId: string) => {
      await runSerial(async () => {
        const currentResults = resultsRef.current;
        if (!currentResults) return;
        const next = clearTestCaseEnvironmentResult(currentResults, testCaseId, envId);
        if (next === currentResults) return;
        await persist({ results: next });
        markTestUpdated(testCaseId);
      });
    },
    [markTestUpdated, persist, runSerial],
  );

  const clearResults = useCallback(async () => {
    await runSerial(async () => {
      const currentDefinition = definitionRef.current;
      if (!currentDefinition) return;
      const projectId = currentDefinition.project.id ?? "project";
      await persist({
        results: createEmptyResults(projectId),
        session: null,
      });
    });
  }, [persist, runSerial]);

  const resetProject = useCallback(async () => {
    await runSerial(async () => {
      await clearState();
      definitionRef.current = null;
      resultsRef.current = null;
      sessionRef.current = null;
      setDefinition(null);
      setResults(null);
      setSessionState(null);
    });
  }, [runSerial]);

  const value = useMemo(
    () => ({
      ready,
      definition,
      results,
      session,
      lastUpdatedTestId,
      loadProject,
      mergeResultsFromFile,
      mergeResultsFromFiles,
      setSession,
      updateResults,
      updateResultsBatch,
      updateResultsFile,
      updateTestCase,
      clearTestResult,
      clearResults,
      resetProject,
    }),
    [
      ready,
      definition,
      results,
      session,
      lastUpdatedTestId,
      loadProject,
      mergeResultsFromFile,
      mergeResultsFromFiles,
      setSession,
      updateResults,
      updateResultsBatch,
      updateResultsFile,
      updateTestCase,
      clearTestResult,
      clearResults,
      resetProject,
    ],
  );

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
}

export function useApp() {
  const ctx = useContext(AppContext);
  if (!ctx) throw new Error("useApp must be used within AppProvider");
  return ctx;
}

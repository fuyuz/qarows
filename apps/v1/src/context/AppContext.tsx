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
  resetProject: () => Promise<void>;
}

const AppContext = createContext<AppContextValue | null>(null);

export function AppProvider({ children }: { children: ReactNode }) {
  const [ready, setReady] = useState(false);
  const [definition, setDefinition] = useState<TestDefinition | null>(null);
  const [results, setResults] = useState<ResultsFile | null>(null);
  const [session, setSessionState] = useState<SessionConfig | null>(null);
  const [lastUpdatedTestId, setLastUpdatedTestId] = useState<string | null>(null);
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

  useEffect(() => {
    void loadState().then((state) => {
      setDefinition(state.definition);
      setResults(state.results);
      setSessionState(state.session);
      setReady(true);
    });
  }, []);

  const persist = useCallback(
    async (next: {
      definition?: TestDefinition | null;
      results?: ResultsFile | null;
      session?: SessionConfig | null;
    }) => {
      const snapshot = {
        definition: next.definition !== undefined ? next.definition : definition,
        results: next.results !== undefined ? next.results : results,
        session: next.session !== undefined ? next.session : session,
      };
      if (next.definition !== undefined) setDefinition(next.definition);
      if (next.results !== undefined) setResults(next.results);
      if (next.session !== undefined) setSessionState(next.session);
      await saveState(snapshot);
    },
    [definition, results, session],
  );

  const loadProject = useCallback(
    async (yaml: string, resultsJson?: string) => {
      const parsedDefinition = parseTestsYaml(yaml);
      const projectId = parsedDefinition.project.id ?? "project";
      let parsedResults = createEmptyResults(projectId);
      if (resultsJson) {
        parsedResults = parseResultsJson(resultsJson);
        if (parsedResults.projectId !== projectId) {
          throw new Error(
            `results.json の projectId (${parsedResults.projectId}) が tests.yml と一致しません`,
          );
        }
      }
      await persist({
        definition: parsedDefinition,
        results: parsedResults,
        session: null,
      });
      return projectId;
    },
    [persist],
  );

  const mergeResultsFromFile = useCallback(
    async (json: string) => {
      if (!results) throw new Error("結果データが読み込まれていません");
      const incoming = parseResultsJson(json);
      const merged = mergeResultsFiles(results, incoming);
      await persist({ results: merged });
    },
    [persist, results],
  );

  const setSession = useCallback(
    async (nextSession: SessionConfig) => {
      validateSession(nextSession);
      await persist({ session: nextSession });
    },
    [persist],
  );

  const stampResultVersion = useCallback(
    (testCaseId: string, entry: TestResultEntry): TestResultEntry => {
      const testCase = definition?.testCases.find((tc) => tc.id === testCaseId);
      if (!testCase) return entry;
      const version = getTestCaseVersion(testCase);
      return version > 1 ? { ...entry, version } : entry;
    },
    [definition],
  );

  const updateResults = useCallback(
    async (testCaseId: string, envId: string, entry: TestResultEntry) => {
      if (!results) return;
      const stamped = stampResultVersion(testCaseId, entry);
      const next: ResultsFile = {
        ...results,
        updatedAt: new Date().toISOString(),
        results: {
          ...results.results,
          [testCaseId]: {
            ...(results.results[testCaseId] ?? {}),
            [envId]: stamped,
          },
        },
      };
      await persist({ results: next });
      markTestUpdated(testCaseId);
    },
    [markTestUpdated, persist, results, stampResultVersion],
  );

  const updateResultsBatch = useCallback(
    async (
      testCaseId: string,
      envIds: string[],
      partial: Pick<TestResultEntry, "status" | "memo"> & { status: TestStatus },
    ) => {
      if (!results || !session) return;
      const testCase = definition?.testCases.find((tc) => tc.id === testCaseId);
      const version = testCase ? getTestCaseVersion(testCase) : 1;
      const now = new Date().toISOString();
      const caseResults = { ...(results.results[testCaseId] ?? {}) };
      for (const envId of envIds) {
        caseResults[envId] = {
          status: partial.status,
          memo: partial.memo ?? caseResults[envId]?.memo,
          executedAt: now,
          executedBy: session.executorName,
          ...(version > 1 ? { version } : {}),
        };
      }
      const next: ResultsFile = {
        ...results,
        updatedAt: now,
        results: {
          ...results.results,
          [testCaseId]: caseResults,
        },
      };
      await persist({ results: next });
      markTestUpdated(testCaseId);
    },
    [definition, markTestUpdated, persist, results, session],
  );

  const updateResultsFile = useCallback(
    async (updater: (prev: ResultsFile) => ResultsFile) => {
      if (!results) return;
      const next = updater(results);
      next.updatedAt = new Date().toISOString();
      await persist({ results: next });
    },
    [persist, results],
  );

  const updateTestCase = useCallback(
    async (
      testCaseId: string,
      patch: Partial<Pick<TestCase, "category" | "prerequisites" | "description" | "version">>,
    ) => {
      if (!definition) return;
      const nextDefinition: TestDefinition = {
        ...definition,
        testCases: definition.testCases.map((tc) =>
          tc.id === testCaseId ? { ...tc, ...patch } : tc,
        ),
      };
      await persist({ definition: nextDefinition });
      markTestUpdated(testCaseId);
    },
    [definition, markTestUpdated, persist],
  );

  const clearTestResult = useCallback(
    async (testCaseId: string, envId: string) => {
      if (!results) return;
      const next = clearTestCaseEnvironmentResult(results, testCaseId, envId);
      if (next === results) return;
      await persist({ results: next });
      markTestUpdated(testCaseId);
    },
    [markTestUpdated, persist, results],
  );

  const resetProject = useCallback(async () => {
    await clearState();
    setDefinition(null);
    setResults(null);
    setSessionState(null);
  }, []);

  const value = useMemo(
    () => ({
      ready,
      definition,
      results,
      session,
      lastUpdatedTestId,
      loadProject,
      mergeResultsFromFile,
      setSession,
      updateResults,
      updateResultsBatch,
      updateResultsFile,
      updateTestCase,
      clearTestResult,
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
      setSession,
      updateResults,
      updateResultsBatch,
      updateResultsFile,
      updateTestCase,
      clearTestResult,
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

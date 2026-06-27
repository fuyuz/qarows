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
  createEmptyResults,
  mergeResultsFiles,
  parseResultsJson,
  parseTestsYaml,
  type ResultsFile,
  type SessionConfig,
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
  runnerIndex: number;
  loadProject: (yaml: string, resultsJson?: string) => Promise<void>;
  mergeResultsFromFile: (json: string) => Promise<void>;
  setSession: (session: SessionConfig) => Promise<void>;
  setRunnerIndex: (index: number) => Promise<void>;
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
  resetProject: () => Promise<void>;
}

const AppContext = createContext<AppContextValue | null>(null);

export function AppProvider({ children }: { children: ReactNode }) {
  const [ready, setReady] = useState(false);
  const [definition, setDefinition] = useState<TestDefinition | null>(null);
  const [results, setResults] = useState<ResultsFile | null>(null);
  const [session, setSessionState] = useState<SessionConfig | null>(null);
  const [runnerIndex, setRunnerIndexState] = useState(0);

  useEffect(() => {
    void loadState().then((state) => {
      setDefinition(state.definition);
      setResults(state.results);
      setSessionState(state.session);
      setRunnerIndexState(state.runnerIndex);
      setReady(true);
    });
  }, []);

  const persist = useCallback(
    async (next: {
      definition?: TestDefinition | null;
      results?: ResultsFile | null;
      session?: SessionConfig | null;
      runnerIndex?: number;
    }) => {
      const snapshot = {
        definition: next.definition !== undefined ? next.definition : definition,
        results: next.results !== undefined ? next.results : results,
        session: next.session !== undefined ? next.session : session,
        runnerIndex: next.runnerIndex !== undefined ? next.runnerIndex : runnerIndex,
      };
      if (next.definition !== undefined) setDefinition(next.definition);
      if (next.results !== undefined) setResults(next.results);
      if (next.session !== undefined) setSessionState(next.session);
      if (next.runnerIndex !== undefined) setRunnerIndexState(next.runnerIndex);
      await saveState(snapshot);
    },
    [definition, results, runnerIndex, session],
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
        runnerIndex: 0,
      });
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
      await persist({ session: nextSession, runnerIndex: 0 });
    },
    [persist],
  );

  const setRunnerIndex = useCallback(
    async (index: number) => {
      await persist({ runnerIndex: index });
    },
    [persist],
  );

  const updateResults = useCallback(
    async (testCaseId: string, envId: string, entry: TestResultEntry) => {
      if (!results) return;
      const next: ResultsFile = {
        ...results,
        updatedAt: new Date().toISOString(),
        results: {
          ...results.results,
          [testCaseId]: {
            ...(results.results[testCaseId] ?? {}),
            [envId]: entry,
          },
        },
      };
      await persist({ results: next });
    },
    [persist, results],
  );

  const updateResultsBatch = useCallback(
    async (
      testCaseId: string,
      envIds: string[],
      partial: Pick<TestResultEntry, "status" | "memo"> & { status: TestStatus },
    ) => {
      if (!results || !session) return;
      const now = new Date().toISOString();
      const caseResults = { ...(results.results[testCaseId] ?? {}) };
      for (const envId of envIds) {
        caseResults[envId] = {
          status: partial.status,
          memo: partial.memo ?? caseResults[envId]?.memo,
          executedAt: now,
          executedBy: session.executorName,
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
    },
    [persist, results, session],
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

  const resetProject = useCallback(async () => {
    await clearState();
    setDefinition(null);
    setResults(null);
    setSessionState(null);
    setRunnerIndexState(0);
  }, []);

  const value = useMemo(
    () => ({
      ready,
      definition,
      results,
      session,
      runnerIndex,
      loadProject,
      mergeResultsFromFile,
      setSession,
      setRunnerIndex,
      updateResults,
      updateResultsBatch,
      updateResultsFile,
      resetProject,
    }),
    [
      ready,
      definition,
      results,
      session,
      runnerIndex,
      loadProject,
      mergeResultsFromFile,
      setSession,
      setRunnerIndex,
      updateResults,
      updateResultsBatch,
      updateResultsFile,
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

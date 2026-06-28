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
import type {
  ResultsFile,
  SessionConfig,
  TestCase,
  TestDefinition,
  TestResultEntry,
  TestStatus,
} from "@qarows/shared";
import type { ProjectCommand, ProjectEvent } from "@qarows/application";
import { createPhase2WorkspaceController } from "@/lib/adapters/create-phase2-workspace";
import { getSyncUser } from "@/lib/sync/sync-user";

interface ProjectSyncContextValue {
  ready: boolean;
  connected: boolean;
  syncError: string | null;
  revision: number;
  definition: TestDefinition | null;
  results: ResultsFile | null;
  session: SessionConfig | null;
  lastUpdatedTestId: string | null;
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
}

const ProjectSyncContext = createContext<ProjectSyncContextValue | null>(null);

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

export function ProjectSyncProvider({
  projectId,
  children,
}: {
  projectId: string;
  children: ReactNode;
}) {
  const [ready, setReady] = useState(false);
  const [connected, setConnected] = useState(false);
  const [syncError, setSyncError] = useState<string | null>(null);
  const [revision, setRevision] = useState(0);
  const [definition, setDefinition] = useState<TestDefinition | null>(null);
  const [results, setResults] = useState<ResultsFile | null>(null);
  const [session, setSessionState] = useState<SessionConfig | null>(null);
  const [lastUpdatedTestId, setLastUpdatedTestId] = useState<string | null>(null);

  const workspaceRef = useRef<ReturnType<typeof createPhase2WorkspaceController> | null>(null);
  const userRef = useRef("dev@local");
  const definitionRef = useRef<TestDefinition | null>(null);
  const resultsRef = useRef<ResultsFile | null>(null);
  const sessionRef = useRef<SessionConfig | null>(null);
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

  const applySnapshotState = useCallback(
    (snapshot: {
      definition: TestDefinition;
      results: ResultsFile;
      session: SessionConfig | null;
    }) => {
      definitionRef.current = snapshot.definition;
      resultsRef.current = snapshot.results;
      sessionRef.current = snapshot.session;
      setDefinition(snapshot.definition);
      setResults(snapshot.results);
      setSessionState(snapshot.session);
    },
    [],
  );

  useEffect(() => {
    let cancelled = false;
    const workspace = createPhase2WorkspaceController();
    workspaceRef.current = workspace;

    const handleEvent = (event: ProjectEvent) => {
      if (cancelled) return;
      switch (event.type) {
        case "snapshot":
          setRevision(event.revision);
          applySnapshotState(event.snapshot);
          setReady(true);
          setSyncError(null);
          return;
        case "commandApplied":
          setRevision(event.revision);
          applySnapshotState(event.snapshot);
          setReady(true);
          setSyncError(null);
          {
            const affected = affectedTestCaseFromCommand(event.command);
            if (affected) markTestUpdated(affected);
          }
          return;
        case "connectionState":
          setConnected(event.state.status === "connected");
          setRevision(event.state.revision);
          return;
        case "error":
          setSyncError(event.message);
          return;
      }
    };

    const unsubscribe = workspace.controller.subscribe(handleEvent);

    void (async () => {
      userRef.current = await getSyncUser();
      if (cancelled) return;
      workspace.channel.setUser(userRef.current);
      await workspace.controller.activateProject(projectId);
    })();

    return () => {
      cancelled = true;
      unsubscribe();
      workspace.controller.deactivateProject();
      workspaceRef.current = null;
    };
  }, [applySnapshotState, markTestUpdated, projectId]);

  const dispatch = useCallback(async (command: ProjectCommand) => {
    const workspace = workspaceRef.current;
    if (!workspace) throw new Error("Sync workspace not ready");
    await workspace.controller.dispatch(command);
  }, []);

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
      await dispatch({
        type: "updateResultsBatch",
        testCaseId,
        envIds,
        partial,
      });
    },
    [dispatch],
  );

  const updateResultsFile = useCallback(
    async (updater: (prev: ResultsFile) => ResultsFile) => {
      const currentResults = resultsRef.current;
      const currentDefinition = definitionRef.current;
      if (!currentResults || !currentDefinition) return;
      const next = updater(currentResults);
      await dispatch({
        type: "replaceSnapshot",
        definition: currentDefinition,
        results: { ...next, updatedAt: new Date().toISOString() },
        session: sessionRef.current,
      });
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

  const value = useMemo<ProjectSyncContextValue>(
    () => ({
      ready,
      connected,
      syncError,
      revision,
      definition,
      results,
      session,
      lastUpdatedTestId,
      setSession,
      updateResults,
      updateResultsBatch,
      updateResultsFile,
      updateTestCase,
      clearTestResult,
    }),
    [
      ready,
      connected,
      syncError,
      revision,
      definition,
      results,
      session,
      lastUpdatedTestId,
      setSession,
      updateResults,
      updateResultsBatch,
      updateResultsFile,
      updateTestCase,
      clearTestResult,
    ],
  );

  return <ProjectSyncContext.Provider value={value}>{children}</ProjectSyncContext.Provider>;
}

export function useProjectSync(): ProjectSyncContextValue {
  const context = useContext(ProjectSyncContext);
  if (!context) {
    throw new Error("useProjectSync must be used within ProjectSyncProvider");
  }
  return context;
}

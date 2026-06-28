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
import type { ResultsFile, SessionConfig, TestDefinition, TestResultEntry, TestStatus } from "@qarows/shared";
import type { ProjectEvent, ProjectCommand } from "@qarows/application";
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
  setSession: (session: SessionConfig) => Promise<void>;
  updateResultsBatch: (
    testCaseId: string,
    envIds: string[],
    partial: Pick<TestResultEntry, "status" | "memo"> & { status: TestStatus },
  ) => Promise<void>;
}

const ProjectSyncContext = createContext<ProjectSyncContextValue | null>(null);

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

  const workspaceRef = useRef<ReturnType<typeof createPhase2WorkspaceController> | null>(null);
  const userRef = useRef("dev@local");

  const applySnapshotState = useCallback((snapshot: {
    definition: TestDefinition;
    results: ResultsFile;
    session: SessionConfig | null;
  }) => {
    setDefinition(snapshot.definition);
    setResults(snapshot.results);
    setSessionState(snapshot.session);
  }, []);

  useEffect(() => {
    let cancelled = false;
    const workspace = createPhase2WorkspaceController();
    workspaceRef.current = workspace;

    const handleEvent = (event: ProjectEvent) => {
      if (cancelled) return;
      switch (event.type) {
        case "snapshot":
        case "commandApplied":
          setRevision(event.revision);
          applySnapshotState(event.snapshot);
          setReady(true);
          setSyncError(null);
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
  }, [applySnapshotState, projectId]);

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

  const value = useMemo<ProjectSyncContextValue>(
    () => ({
      ready,
      connected,
      syncError,
      revision,
      definition,
      results,
      session,
      setSession,
      updateResultsBatch,
    }),
    [
      ready,
      connected,
      syncError,
      revision,
      definition,
      results,
      session,
      setSession,
      updateResultsBatch,
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

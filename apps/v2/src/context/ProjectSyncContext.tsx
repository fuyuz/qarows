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
  getTestCaseVersion,
  validateSession,
  type ResultsFile,
  type SessionConfig,
  type TestDefinition,
  type TestResultEntry,
  type TestStatus,
} from "@qarows/shared";
import { ProjectSyncClient } from "@/lib/sync/project-sync-client";
import type { RoomSnapshot } from "@/lib/sync/protocol";
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

function applySnapshot(snapshot: RoomSnapshot) {
  return {
    revision: snapshot.revision,
    definition: snapshot.definition,
    results: snapshot.results,
    session: snapshot.session,
  };
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

  const clientRef = useRef<ProjectSyncClient | null>(null);
  const userRef = useRef("dev@local");
  const definitionRef = useRef<TestDefinition | null>(null);
  const resultsRef = useRef<ResultsFile | null>(null);
  const sessionRef = useRef<SessionConfig | null>(null);

  useEffect(() => {
    definitionRef.current = definition;
  }, [definition]);
  useEffect(() => {
    resultsRef.current = results;
  }, [results]);
  useEffect(() => {
    sessionRef.current = session;
  }, [session]);

  useEffect(() => {
    let cancelled = false;
    const client = new ProjectSyncClient();
    clientRef.current = client;

    void (async () => {
      userRef.current = await getSyncUser();
      if (cancelled) return;

      client.connect(projectId, userRef.current, {
        onOpen: () => {
          if (!cancelled) setConnected(true);
        },
        onClose: () => {
          if (!cancelled) setConnected(false);
        },
        onSnapshot: (snapshot) => {
          if (cancelled) return;
          const next = applySnapshot(snapshot);
          setRevision(next.revision);
          setDefinition(next.definition);
          setResults(next.results);
          setSessionState(next.session);
          setReady(true);
          setSyncError(null);
        },
        onPatch: (document, payload, nextRevision) => {
          if (cancelled) return;
          setRevision(nextRevision);
          if (document === "results") {
            setResults(payload as ResultsFile);
          } else {
            setSessionState(payload as SessionConfig | null);
          }
        },
        onError: (message) => {
          if (!cancelled) setSyncError(message);
        },
      });
    })();

    return () => {
      cancelled = true;
      client.disconnect();
      clientRef.current = null;
    };
  }, [projectId]);

  const patchDocument = useCallback(
    async (document: "results" | "session", payload: ResultsFile | SessionConfig | null) => {
      const client = clientRef.current;
      if (!client) throw new Error("Sync client not ready");
      client.patch(document, payload, userRef.current);
      if (document === "results") {
        setResults(payload as ResultsFile);
      } else {
        setSessionState(payload as SessionConfig | null);
      }
    },
    [],
  );

  const setSession = useCallback(
    async (nextSession: SessionConfig) => {
      validateSession(nextSession);
      await patchDocument("session", nextSession);
    },
    [patchDocument],
  );

  const updateResultsBatch = useCallback(
    async (
      testCaseId: string,
      envIds: string[],
      partial: Pick<TestResultEntry, "status" | "memo"> & { status: TestStatus },
    ) => {
      const currentResults = resultsRef.current;
      const currentSession = sessionRef.current;
      const currentDefinition = definitionRef.current;
      if (!currentResults || !currentSession) {
        throw new Error("セッションが開始されていません");
      }

      const testCase = currentDefinition?.testCases.find((tc) => tc.id === testCaseId);
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

      await patchDocument("results", next);
    },
    [patchDocument],
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

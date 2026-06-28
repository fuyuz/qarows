import { Navigate } from "react-router-dom";
import { isValidSession } from "@qarows/shared";
import { Alert, AlertDescription, Badge, Button, StatusBadge } from "@qarows/ui";
import { AppNav } from "@/components/AppNav";
import { useProjectSync } from "@/context/ProjectSyncContext";
import { useProjectRoutes } from "@/hooks/useProjectRoutes";

export function RunPage() {
  const { definition, session, results, syncError, updateResultsBatch } = useProjectSync();
  const { path } = useProjectRoutes();

  if (!definition || !session || !isValidSession(session)) {
    return <Navigate to={path("session")} replace />;
  }

  const envIds = session.selectedEnvironmentIds;

  return (
    <div className="flex h-svh flex-col overflow-hidden">
      <AppNav />
      <main className="mx-auto flex min-h-0 w-full max-w-3xl flex-1 flex-col gap-4 overflow-y-auto px-5 py-6">
        <header>
          <h1 className="text-2xl font-bold tracking-tight">テスト実行</h1>
          <p className="text-sm text-muted-foreground">
            {session.executorName} — {envIds.length} 端末/環境（リアルタイム同期）
          </p>
        </header>

        {syncError && (
          <Alert variant="destructive">
            <AlertDescription>{syncError}</AlertDescription>
          </Alert>
        )}

        <ul className="flex flex-col gap-3">
          {definition.testCases.map((testCase) => {
            const caseResults = results?.results[testCase.id] ?? {};
            const statuses = envIds.map((envId) => caseResults[envId]?.status ?? null);
            const allOk = statuses.every((status) => status === "OK");

            return (
              <li key={testCase.id} className="rounded-xl border bg-card p-4">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="font-mono text-xs text-muted-foreground">{testCase.id}</p>
                    <p className="mt-1 font-medium">{testCase.description}</p>
                    <p className="mt-1 text-xs text-muted-foreground">{testCase.category.major}</p>
                  </div>
                  <div className="flex flex-wrap gap-1">
                    {envIds.map((envId) => {
                      const status = caseResults[envId]?.status;
                      return status ? (
                        <StatusBadge key={envId} status={status} />
                      ) : (
                        <Badge key={envId} variant="outline">
                          未
                        </Badge>
                      );
                    })}
                  </div>
                </div>
                <div className="mt-3 flex flex-wrap gap-2">
                  <Button
                    size="sm"
                    disabled={allOk}
                    onClick={() =>
                      void updateResultsBatch(testCase.id, envIds, { status: "OK" })
                    }
                  >
                    一括 OK
                  </Button>
                  <Button
                    size="sm"
                    variant="destructive"
                    onClick={() =>
                      void updateResultsBatch(testCase.id, envIds, { status: "NG" })
                    }
                  >
                    一括 NG
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() =>
                      void updateResultsBatch(testCase.id, envIds, { status: "SKIP" })
                    }
                  >
                    一括 SKIP
                  </Button>
                </div>
              </li>
            );
          })}
        </ul>
      </main>
    </div>
  );
}

import { Navigate, useNavigate } from "react-router-dom";
import { SessionSetupForm } from "@qarows/ui";
import { AppNav } from "@/components/AppNav";
import { useProjectSync } from "@/context/ProjectSyncContext";
import { useProjectRoutes } from "@/hooks/useProjectRoutes";

export function SessionPage() {
  const navigate = useNavigate();
  const { definition, session, syncError, setSession } = useProjectSync();
  const { path } = useProjectRoutes();

  if (!definition) return null;

  return (
    <div className="flex min-h-svh flex-col">
      <AppNav />
      <main className="mx-auto max-w-2xl flex-1 px-5 py-8 pb-12">
        <SessionSetupForm
          projectName={definition.project.name}
          environments={definition.environments}
          initialExecutorName={session?.executorName}
          initialSelectedEnvIds={session?.selectedEnvironmentIds}
          syncError={syncError}
          disableSubmitUntilValid={false}
          submittingSubmitLabel="保存中…"
          showEmptyEnvHint={false}
          onSubmit={async (nextSession) => {
            await setSession(nextSession);
            navigate(path("run"));
          }}
        />
      </main>
    </div>
  );
}

export function SessionPageRoute() {
  const { ready, definition } = useProjectSync();
  if (!ready) return null;
  if (!definition) return <Navigate to="/projects" replace />;
  return <SessionPage />;
}

import { Navigate, useNavigate } from "react-router-dom";
import { SessionSetupForm } from "@qarows/ui";
import { AppNav } from "@/components/AppNav";
import { useProjectSync } from "@/context/ProjectSyncContext";
import { useProjectRoutes } from "@/hooks/useProjectRoutes";

export function SessionPage() {
  const navigate = useNavigate();
  const { definition, session, syncError, setSession, userEmail } = useProjectSync();
  const { path } = useProjectRoutes();

  if (!definition) return null;

  return (
    <>
      <AppNav />
      <main className="mx-auto max-w-2xl px-5 py-8 pb-12">
        <SessionSetupForm
          projectName={definition.project.name}
          environments={definition.environments}
          initialSelectedEnvIds={session?.selectedEnvironmentIds}
          fixedExecutorName={userEmail ?? undefined}
          syncError={syncError}
          submittingSubmitLabel="保存中…"
          onSubmit={async ({ selectedEnvironmentIds }) => {
            await setSession(selectedEnvironmentIds);
            navigate(path("run"));
          }}
        />
      </main>
    </>
  );
}

export function SessionPageRoute() {
  const { ready, definition } = useProjectSync();
  if (!ready) return null;
  if (!definition) return <Navigate to="/projects" replace />;
  return <SessionPage />;
}

import { useNavigate } from "react-router-dom";
import { SessionSetupForm } from "@qarows/ui";
import { AppNav } from "@/components/AppNav";
import { useApp } from "@/context/AppContext";
import { useProjectRoutes } from "@/hooks/useProjectRoutes";

export function SessionPage() {
  const navigate = useNavigate();
  const { definition, session, setSession } = useApp();
  const { path } = useProjectRoutes();

  if (!definition) return null;

  return (
    <>
      <AppNav />
      <main className="mx-auto max-w-2xl px-5 py-8 pb-12">
        <SessionSetupForm
          projectName={definition.project.name}
          environments={definition.environments}
          initialExecutorName={session?.executorName}
          initialSelectedEnvIds={session?.selectedEnvironmentIds}
          onSubmit={async (nextSession) => {
            await setSession(nextSession);
            navigate(path("run"));
          }}
        />
      </main>
    </>
  );
}

import { Navigate } from "react-router-dom";
import { isValidSession } from "@qarows/shared";
import { RunPageLayout } from "@qarows/runner-ui";
import { AppNav } from "@/components/AppNav";
import { useProjectSync } from "@/context/ProjectSyncContext";
import { useProjectRoutes } from "@/hooks/useProjectRoutes";

export function RunPage() {
  const { definition, session } = useProjectSync();
  const { path } = useProjectRoutes();

  if (!definition || !session || !isValidSession(session)) {
    return <Navigate to={path("session")} replace />;
  }

  return <RunPageLayout nav={<AppNav />} />;
}

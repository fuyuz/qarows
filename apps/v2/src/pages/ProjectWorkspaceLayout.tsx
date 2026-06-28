import { Navigate, Outlet, useParams } from "react-router-dom";
import { LoadingScreen } from "@/components/LoadingScreen";
import { ProjectSyncProvider, useProjectSync } from "@/context/ProjectSyncContext";
import { RunPage } from "@/pages/RunPage";
import { SessionPageRoute } from "@/pages/SessionPage";
import type { ProjectPage } from "@/lib/project-routes";

function ProjectWorkspaceShell() {
  const { ready, syncError, connected } = useProjectSync();

  if (!ready) {
    return <LoadingScreen label={connected ? "同期データを読み込み中…" : "サーバーに接続中…"} />;
  }

  if (syncError && !ready) {
    return (
      <div className="flex h-svh items-center justify-center px-5 text-sm text-destructive">
        {syncError}
      </div>
    );
  }

  return <Outlet />;
}

export function ProjectWorkspaceLayout() {
  const { projectId } = useParams<{ projectId: string }>();
  if (!projectId) return <Navigate to="/projects" replace />;

  return (
    <ProjectSyncProvider projectId={projectId}>
      <ProjectWorkspaceShell />
    </ProjectSyncProvider>
  );
}

export function ProjectPageRouter() {
  const { page } = useParams<{ page: ProjectPage }>();

  switch (page) {
    case "session":
      return <SessionPageRoute />;
    case "run":
      return <RunPage />;
    default:
      return <Navigate to="session" replace />;
  }
}

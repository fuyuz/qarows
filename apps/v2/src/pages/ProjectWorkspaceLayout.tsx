import { Navigate, Outlet, useParams } from "react-router-dom";
import { LoadingScreen } from "@/components/LoadingScreen";
import { RunnerWorkspaceBridge } from "@/components/RunnerWorkspaceBridge";
import { ProjectSyncProvider, useProjectSync } from "@/context/ProjectSyncContext";
import { BugsPage } from "@/pages/BugsPage";
import { DashboardPage } from "@/pages/DashboardPage";
import { MatrixPage } from "@/pages/MatrixPage";
import { RunPage } from "@/pages/RunPage";
import { SessionPageRoute } from "@/pages/SessionPage";
import type { ProjectPage } from "@/lib/project-routes";

function ProjectWorkspaceShell() {
  const { ready, syncError, connected, syncNotice } = useProjectSync();

  if (!ready) {
    return (
      <LoadingScreen
        message={connected ? "同期データを読み込み中…" : "サーバーに接続中…"}
      />
    );
  }

  if (syncError && !ready) {
    return (
      <div className="flex h-svh items-center justify-center px-5 text-sm text-destructive">
        {syncError}
      </div>
    );
  }

  return (
    <RunnerWorkspaceBridge>
      {syncNotice && (
        <div
          className="pointer-events-none fixed inset-x-0 top-0 z-50 flex justify-center px-4 pt-3"
          role="status"
        >
          <div className="pointer-events-auto rounded-md border border-amber-200 bg-amber-50 px-4 py-2 text-sm text-amber-950 shadow-sm">
            {syncNotice}
          </div>
        </div>
      )}
      <Outlet />
    </RunnerWorkspaceBridge>
  );
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
    case "matrix":
      return <MatrixPage />;
    case "dashboard":
      return <DashboardPage />;
    case "bugs":
      return <BugsPage />;
    default:
      return <Navigate to="session" replace />;
  }
}

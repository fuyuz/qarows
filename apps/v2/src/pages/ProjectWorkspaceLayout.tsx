import { lazy, Suspense } from "react";
import { Navigate, Outlet, useParams } from "react-router-dom";
import { DocumentTitleSync, useTranslation } from "@qarows/ui";
import { LoadingScreen } from "@/components/LoadingScreen";
import { RunnerWorkspaceBridge } from "@/components/RunnerWorkspaceBridge";
import { ProjectSyncProvider, useProjectSync } from "@/context/ProjectSyncContext";
import type { ProjectPage } from "@/lib/project-routes";

const SessionPageRoute = lazy(() =>
  import("@/pages/SessionPage").then((m) => ({ default: m.SessionPageRoute })),
);
const RunPage = lazy(() => import("@/pages/RunPage").then((m) => ({ default: m.RunPage })));
const MatrixPage = lazy(() =>
  import("@/pages/MatrixPage").then((m) => ({ default: m.MatrixPage })),
);
const DashboardPage = lazy(() =>
  import("@/pages/DashboardPage").then((m) => ({ default: m.DashboardPage })),
);
const BugsPage = lazy(() => import("@/pages/BugsPage").then((m) => ({ default: m.BugsPage })));
const TestsEditPage = lazy(() =>
  import("@/pages/TestsEditPage").then((m) => ({ default: m.TestsEditPage })),
);

function ProjectWorkspaceShell() {
  const { t } = useTranslation();
  const { ready, syncError, connected, syncNotice, definition } = useProjectSync();

  const titleSync = (
    <DocumentTitleSync
      brand="qarows Team"
      projectName={ready ? (definition?.project.name ?? null) : null}
    />
  );

  if (!ready) {
    if (syncError) {
      return (
        <>
          {titleSync}
          <div className="flex h-svh items-center justify-center px-5 text-sm text-destructive">
            {syncError}
          </div>
        </>
      );
    }

    return (
      <>
        {titleSync}
        <LoadingScreen
          message={connected ? t("sync.loadingSync") : t("sync.connectingServer")}
        />
      </>
    );
  }

  return (
    <RunnerWorkspaceBridge>
      {titleSync}
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
    <ProjectSyncProvider key={projectId} projectId={projectId}>
      <ProjectWorkspaceShell />
    </ProjectSyncProvider>
  );
}

function PageFallback() {
  const { t } = useTranslation();
  return <LoadingScreen message={t("sync.loadingPage")} />;
}

export function ProjectPageRouter() {
  const { page } = useParams<{ page: ProjectPage }>();

  let content;
  switch (page) {
    case "session":
      content = <SessionPageRoute />;
      break;
    case "run":
      content = <RunPage />;
      break;
    case "matrix":
      content = <MatrixPage />;
      break;
    case "dashboard":
      content = <DashboardPage />;
      break;
    case "bugs":
      content = <BugsPage />;
      break;
    case "tests":
      content = <TestsEditPage />;
      break;
    default:
      return <Navigate to="session" replace />;
  }

  return <Suspense fallback={<PageFallback />}>{content}</Suspense>;
}

import { lazy, Suspense, type ComponentType, type ReactNode } from "react";
import { Navigate, createBrowserRouter, useLocation, useParams } from "react-router-dom";
import { isValidSession } from "@qarows/shared";
import { useApp } from "@/context/AppContext";
import { LoadingScreen } from "@/components/LoadingScreen";
import { projectPath } from "@/lib/project-routes";

const HomePage = lazy(() =>
  import("@/pages/HomePage").then((m) => ({ default: m.HomePage })),
);
const SessionPage = lazy(() =>
  import("@/pages/SessionPage").then((m) => ({ default: m.SessionPage })),
);
const RunPage = lazy(() => import("@/pages/RunPage").then((m) => ({ default: m.RunPage })));
const MatrixPage = lazy(() =>
  import("@/pages/MatrixPage").then((m) => ({ default: m.MatrixPage })),
);
const DashboardPage = lazy(() =>
  import("@/pages/DashboardPage").then((m) => ({ default: m.DashboardPage })),
);
const BugsPage = lazy(() => import("@/pages/BugsPage").then((m) => ({ default: m.BugsPage })));

function withSuspense(Component: ComponentType): ReactNode {
  return (
    <Suspense fallback={<LoadingScreen />}>
      <Component />
    </Suspense>
  );
}

function RootRedirect() {
  const { ready, definition, session } = useApp();
  if (!ready) return <LoadingScreen />;
  if (!definition) return <Navigate to="/load" replace />;
  const projectId = definition.project.id ?? "project";
  if (session && isValidSession(session)) {
    return <Navigate to={projectPath(projectId, "run")} replace />;
  }
  return <Navigate to={projectPath(projectId, "session")} replace />;
}

function RequireDefinition({ children }: { children: ReactNode }) {
  const { ready, definition } = useApp();
  if (!ready) return <LoadingScreen />;
  if (!definition) return <Navigate to="/load" replace />;
  return children;
}

function RequireProjectMatch({ children }: { children: ReactNode }) {
  const { projectId } = useParams();
  const { ready, definition } = useApp();
  if (!ready) return <LoadingScreen />;
  if (!definition) return <Navigate to="/load" replace />;
  if (!projectId || projectId !== (definition.project.id ?? "project")) {
    return <Navigate to="/load" replace />;
  }
  return children;
}

function RequireSession({ children }: { children: ReactNode }) {
  const location = useLocation();
  const { ready, definition, session } = useApp();
  if (!ready) return <LoadingScreen />;
  if (!definition) return <Navigate to="/load" replace />;
  if (!session || !isValidSession(session)) {
    const projectId = definition.project.id ?? "project";
    return (
      <Navigate
        to={{ pathname: projectPath(projectId, "session"), search: location.search }}
        replace
      />
    );
  }
  return children;
}

function LoadPage() {
  const { ready } = useApp();
  if (!ready) return <LoadingScreen />;
  return withSuspense(HomePage);
}

function ProjectSessionPage() {
  return (
    <RequireProjectMatch>
      <RequireDefinition>{withSuspense(SessionPage)}</RequireDefinition>
    </RequireProjectMatch>
  );
}

function ProjectRunPage() {
  return (
    <RequireProjectMatch>
      <RequireSession>{withSuspense(RunPage)}</RequireSession>
    </RequireProjectMatch>
  );
}

function ProjectMatrixPage() {
  return (
    <RequireProjectMatch>
      <RequireDefinition>{withSuspense(MatrixPage)}</RequireDefinition>
    </RequireProjectMatch>
  );
}

function ProjectDashboardPage() {
  return (
    <RequireProjectMatch>
      <RequireDefinition>{withSuspense(DashboardPage)}</RequireDefinition>
    </RequireProjectMatch>
  );
}

function ProjectBugsPage() {
  return (
    <RequireProjectMatch>
      <RequireDefinition>{withSuspense(BugsPage)}</RequireDefinition>
    </RequireProjectMatch>
  );
}

export const router = createBrowserRouter([
  { path: "/load", element: <LoadPage /> },
  { path: "/p/:projectId/session", element: <ProjectSessionPage /> },
  { path: "/p/:projectId/run", element: <ProjectRunPage /> },
  { path: "/p/:projectId/matrix", element: <ProjectMatrixPage /> },
  { path: "/p/:projectId/dashboard", element: <ProjectDashboardPage /> },
  { path: "/p/:projectId/bugs", element: <ProjectBugsPage /> },
  { path: "/", element: <RootRedirect /> },
  { path: "*", element: <Navigate to="/load" replace /> },
]);

/** ルート単位 lazy import のスモークテスト用 */
export const lazyPageModules = {
  HomePage: () => import("@/pages/HomePage"),
  SessionPage: () => import("@/pages/SessionPage"),
  RunPage: () => import("@/pages/RunPage"),
  MatrixPage: () => import("@/pages/MatrixPage"),
  DashboardPage: () => import("@/pages/DashboardPage"),
  BugsPage: () => import("@/pages/BugsPage"),
} as const;

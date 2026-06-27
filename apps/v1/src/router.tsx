import { Navigate, createBrowserRouter, useLocation, useParams } from "react-router-dom";
import { isValidSession } from "@qarows/shared";
import { useApp } from "@/context/AppContext";
import { HomePage } from "@/pages/HomePage";
import { DashboardPage } from "@/pages/DashboardPage";
import { MatrixPage } from "@/pages/MatrixPage";
import { RunPage } from "@/pages/RunPage";
import { SessionPage } from "@/pages/SessionPage";
import { projectPath } from "@/lib/project-routes";
import type { ReactNode } from "react";

function LoadingScreen() {
  return (
    <main className="page" style={{ textAlign: "center" }}>
      <p>読み込み中…</p>
    </main>
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
  return <HomePage />;
}

function ProjectSessionPage() {
  return (
    <RequireProjectMatch>
      <RequireDefinition>
        <SessionPage />
      </RequireDefinition>
    </RequireProjectMatch>
  );
}

function ProjectRunPage() {
  return (
    <RequireProjectMatch>
      <RequireSession>
        <RunPage />
      </RequireSession>
    </RequireProjectMatch>
  );
}

function ProjectMatrixPage() {
  return (
    <RequireProjectMatch>
      <RequireDefinition>
        <MatrixPage />
      </RequireDefinition>
    </RequireProjectMatch>
  );
}

function ProjectDashboardPage() {
  return (
    <RequireProjectMatch>
      <RequireDefinition>
        <DashboardPage />
      </RequireDefinition>
    </RequireProjectMatch>
  );
}

export const router = createBrowserRouter([
  { path: "/load", element: <LoadPage /> },
  { path: "/p/:projectId/session", element: <ProjectSessionPage /> },
  { path: "/p/:projectId/run", element: <ProjectRunPage /> },
  { path: "/p/:projectId/matrix", element: <ProjectMatrixPage /> },
  { path: "/p/:projectId/dashboard", element: <ProjectDashboardPage /> },
  { path: "/", element: <RootRedirect /> },
  { path: "*", element: <Navigate to="/load" replace /> },
]);

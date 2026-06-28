import { lazy, Suspense, useEffect, useState, type ComponentType, type ReactNode } from "react";
import { Navigate, createBrowserRouter, useLocation, useNavigate, useParams } from "react-router-dom";
import { isValidSession } from "@qarows/shared";
import { useApp } from "@/context/AppContext";
import { LoadingScreen } from "@/components/LoadingScreen";
import { RunnerWorkspaceBridge } from "@/components/RunnerWorkspaceBridge";
import { projectPath } from "@/lib/project-routes";
import { runnerSearchChanged, sanitizeRunnerSearchParams } from "@/lib/runner-query";

const HomePage = lazy(() =>
  import("@/pages/HomePage").then((m) => ({ default: m.HomePage })),
);
const LandingPage = lazy(() =>
  import("@/pages/LandingPage").then((m) => ({ default: m.LandingPage })),
);
const ProjectsPage = lazy(() =>
  import("@/pages/ProjectsPage").then((m) => ({ default: m.ProjectsPage })),
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

function LandingRoute() {
  const { ready } = useApp();
  if (!ready) return <LoadingScreen />;
  return withSuspense(LandingPage);
}

function ProjectsRoute() {
  const { ready } = useApp();
  if (!ready) return <LoadingScreen />;
  return withSuspense(ProjectsPage);
}

function RequireDefinition({ children }: { children: ReactNode }) {
  const { ready, definition } = useApp();
  if (!ready) return <LoadingScreen />;
  if (!definition) return <Navigate to="/projects" replace />;
  return children;
}

function RequireProjectMatch({ children }: { children: ReactNode }) {
  const { projectId } = useParams();
  const location = useLocation();
  const navigate = useNavigate();
  const { ready, activeProjectId, definition, results, activateProject, hasProject } = useApp();
  const [phase, setPhase] = useState<"idle" | "activating" | "ready">("idle");

  useEffect(() => {
    if (!ready || !projectId) return;

    let cancelled = false;
    void (async () => {
      if (activeProjectId === projectId && definition) {
        if (!cancelled) setPhase("ready");
        return;
      }

      setPhase("activating");
      const exists = await hasProject(projectId);
      if (cancelled) return;
      if (!exists) {
        navigate("/projects", { replace: true });
        return;
      }

      const ok = await activateProject(projectId);
      if (cancelled) return;
      if (!ok) {
        navigate("/projects", { replace: true });
        return;
      }
      setPhase("ready");
    })();

    return () => {
      cancelled = true;
    };
  }, [ready, projectId, activeProjectId, definition, activateProject, hasProject, navigate]);

  useEffect(() => {
    if (phase !== "ready" || !definition || !results || !projectId || activeProjectId !== projectId) {
      return;
    }

    const current = new URLSearchParams(location.search);
    const sanitized = sanitizeRunnerSearchParams(definition, results, current);
    if (runnerSearchChanged(current, sanitized)) {
      const search = sanitized.toString();
      navigate(
        { pathname: location.pathname, search: search ? `?${search}` : "" },
        { replace: true },
      );
    }
  }, [
    phase,
    definition,
    results,
    projectId,
    activeProjectId,
    location.pathname,
    location.search,
    navigate,
  ]);

  if (!ready || !projectId || phase !== "ready") return <LoadingScreen />;
  if (!definition || activeProjectId !== projectId) return <LoadingScreen />;
  return children;
}

function RequireSession({ children }: { children: ReactNode }) {
  const location = useLocation();
  const { ready, definition, session } = useApp();
  if (!ready) return <LoadingScreen />;
  if (!definition) return <Navigate to="/projects" replace />;
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
      <RequireDefinition>
        <RunnerWorkspaceBridge>{withSuspense(MatrixPage)}</RunnerWorkspaceBridge>
      </RequireDefinition>
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
      <RequireDefinition>
        <RunnerWorkspaceBridge>{withSuspense(BugsPage)}</RunnerWorkspaceBridge>
      </RequireDefinition>
    </RequireProjectMatch>
  );
}

export const router = createBrowserRouter([
  { path: "/projects", element: <ProjectsRoute /> },
  { path: "/load", element: <LoadPage /> },
  { path: "/p/:projectId/session", element: <ProjectSessionPage /> },
  { path: "/p/:projectId/run", element: <ProjectRunPage /> },
  { path: "/p/:projectId/matrix", element: <ProjectMatrixPage /> },
  { path: "/p/:projectId/dashboard", element: <ProjectDashboardPage /> },
  { path: "/p/:projectId/bugs", element: <ProjectBugsPage /> },
  { path: "/", element: <LandingRoute /> },
  { path: "*", element: <Navigate to="/projects" replace /> },
]);

/** ルート単位 lazy import のスモークテスト用 */
export const lazyPageModules = {
  LandingPage: () => import("@/pages/LandingPage"),
  ProjectsPage: () => import("@/pages/ProjectsPage"),
  HomePage: () => import("@/pages/HomePage"),
  SessionPage: () => import("@/pages/SessionPage"),
  RunPage: () => import("@/pages/RunPage"),
  MatrixPage: () => import("@/pages/MatrixPage"),
  DashboardPage: () => import("@/pages/DashboardPage"),
  BugsPage: () => import("@/pages/BugsPage"),
} as const;

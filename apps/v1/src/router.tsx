import { Navigate, createBrowserRouter } from "react-router-dom";
import { isValidSession } from "@qarows/shared";
import { useApp } from "@/context/AppContext";
import { HomePage } from "@/pages/HomePage";
import { RunPage } from "@/pages/RunPage";
import { SessionPage } from "@/pages/SessionPage";
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
  if (session && isValidSession(session)) return <Navigate to="/run" replace />;
  return <Navigate to="/session" replace />;
}

function RequireDefinition({ children }: { children: ReactNode }) {
  const { ready, definition } = useApp();
  if (!ready) return <LoadingScreen />;
  if (!definition) return <Navigate to="/load" replace />;
  return children;
}

function RequireSession({ children }: { children: ReactNode }) {
  const { ready, definition, session } = useApp();
  if (!ready) return <LoadingScreen />;
  if (!definition) return <Navigate to="/load" replace />;
  if (!session || !isValidSession(session)) return <Navigate to="/session" replace />;
  return children;
}

function LoadPage() {
  const { ready } = useApp();
  if (!ready) return <LoadingScreen />;
  return <HomePage />;
}

export const router = createBrowserRouter([
  { path: "/load", element: <LoadPage /> },
  {
    path: "/session",
    element: (
      <RequireDefinition>
        <SessionPage />
      </RequireDefinition>
    ),
  },
  {
    path: "/run",
    element: (
      <RequireSession>
        <RunPage />
      </RequireSession>
    ),
  },
  { path: "/", element: <RootRedirect /> },
  { path: "*", element: <Navigate to="/load" replace /> },
]);

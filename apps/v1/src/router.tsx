import { Navigate, createBrowserRouter } from "react-router-dom";
import { useApp } from "@/context/AppContext";
import { HomePage } from "@/pages/HomePage";
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
  const { ready, definition } = useApp();
  if (!ready) return <LoadingScreen />;
  return <Navigate to={definition ? "/session" : "/load"} replace />;
}

function RequireDefinition({ children }: { children: ReactNode }) {
  const { ready, definition } = useApp();
  if (!ready) return <LoadingScreen />;
  if (!definition) return <Navigate to="/load" replace />;
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
  { path: "/", element: <RootRedirect /> },
  { path: "*", element: <Navigate to="/load" replace /> },
]);

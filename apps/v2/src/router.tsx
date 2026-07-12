import { Outlet, Navigate, createBrowserRouter, useLocation } from "react-router-dom";
import { DocumentTitleSync, isProjectWorkspacePath } from "@qarows/ui";
import {
  ProjectPageRouter,
  ProjectWorkspaceLayout,
} from "@/pages/ProjectWorkspaceLayout";

function RootLayout() {
  const { pathname } = useLocation();
  const onProjectRoute = isProjectWorkspacePath(pathname);

  return (
    <>
      {/* プロジェクト内タイトルは ProjectWorkspaceShell が単独で担当 */}
      <DocumentTitleSync brand="qarows Team" enabled={!onProjectRoute} />
      <Outlet />
    </>
  );
}

export const router = createBrowserRouter([
  {
    element: <RootLayout />,
    children: [
      { path: "/", element: <Navigate to="/projects" replace /> },
      {
        path: "/projects",
        lazy: () =>
          import("@/pages/ProjectsPage").then((m) => ({
            Component: m.ProjectsPage,
          })),
      },
      {
        path: "/p/:projectId",
        element: <ProjectWorkspaceLayout />,
        children: [
          { index: true, element: <Navigate to="session" replace /> },
          { path: ":page", element: <ProjectPageRouter /> },
        ],
      },
      { path: "*", element: <Navigate to="/projects" replace /> },
    ],
  },
]);

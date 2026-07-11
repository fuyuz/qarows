import { Navigate, createBrowserRouter } from "react-router-dom";
import { ProjectPageRouter, ProjectWorkspaceLayout } from "@/pages/ProjectWorkspaceLayout";
import { ProjectsPage } from "@/pages/ProjectsPage";

export const router = createBrowserRouter([
  { path: "/", element: <Navigate to="/projects" replace /> },
  { path: "/projects", element: <ProjectsPage /> },
  {
    path: "/p/:projectId",
    element: <ProjectWorkspaceLayout />,
    children: [
      { index: true, element: <Navigate to="session" replace /> },
      { path: ":page", element: <ProjectPageRouter /> },
    ],
  },
  { path: "*", element: <Navigate to="/projects" replace /> },
]);

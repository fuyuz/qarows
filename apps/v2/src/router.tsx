import { Navigate, createBrowserRouter } from "react-router-dom";
import {
  ProjectPageRouter,
  ProjectWorkspaceLayout,
} from "@/pages/ProjectWorkspaceLayout";

export const router = createBrowserRouter([
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
]);

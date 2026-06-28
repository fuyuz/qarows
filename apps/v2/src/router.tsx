import { Navigate, Route, Routes } from "react-router-dom";
import { ProjectPageRouter, ProjectWorkspaceLayout } from "@/pages/ProjectWorkspaceLayout";
import { ProjectsPage } from "@/pages/ProjectsPage";

export function AppRoutes() {
  return (
    <Routes>
      <Route path="/" element={<Navigate to="/projects" replace />} />
      <Route path="/projects" element={<ProjectsPage />} />
      <Route path="/p/:projectId" element={<ProjectWorkspaceLayout />}>
        <Route index element={<Navigate to="session" replace />} />
        <Route path=":page" element={<ProjectPageRouter />} />
      </Route>
      <Route path="*" element={<Navigate to="/projects" replace />} />
    </Routes>
  );
}

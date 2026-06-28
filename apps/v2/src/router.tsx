import { Navigate, Route, Routes } from "react-router-dom";
import { ProjectWorkspacePage } from "@/pages/ProjectWorkspacePage";
import { ProjectsPage } from "@/pages/ProjectsPage";

export function AppRoutes() {
  return (
    <Routes>
      <Route path="/" element={<Navigate to="/projects" replace />} />
      <Route path="/projects" element={<ProjectsPage />} />
      <Route path="/p/:projectId/:page" element={<ProjectWorkspacePage />} />
      <Route path="*" element={<Navigate to="/projects" replace />} />
    </Routes>
  );
}

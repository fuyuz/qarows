import { Navigate } from "react-router-dom";
import { NEW_PROJECT_SELECTION, projectsHubPath } from "@/lib/project-routes";

export function HomePage() {
  return <Navigate to={projectsHubPath(NEW_PROJECT_SELECTION)} replace />;
}

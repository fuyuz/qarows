import { NuqsAdapter } from "nuqs/adapters/react-router/v7";
import { BrowserRouter } from "react-router-dom";
import { ProjectsProvider } from "@/context/ProjectsContext";
import { AppRoutes } from "@/router";

export function App() {
  return (
    <BrowserRouter>
      <NuqsAdapter>
        <ProjectsProvider>
          <AppRoutes />
        </ProjectsProvider>
      </NuqsAdapter>
    </BrowserRouter>
  );
}

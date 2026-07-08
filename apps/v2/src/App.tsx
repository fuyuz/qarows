import { NuqsAdapter } from "nuqs/adapters/react-router/v7";
import { BrowserRouter } from "react-router-dom";
import { AiFeaturesProvider } from "@/context/AiFeaturesContext";
import { ProjectsProvider } from "@/context/ProjectsContext";
import { AppRoutes } from "@/router";

export function App() {
  return (
    <BrowserRouter>
      <NuqsAdapter>
        <AiFeaturesProvider>
          <ProjectsProvider>
            <AppRoutes />
          </ProjectsProvider>
        </AiFeaturesProvider>
      </NuqsAdapter>
    </BrowserRouter>
  );
}

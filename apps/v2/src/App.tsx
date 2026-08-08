import { NuqsAdapter } from "nuqs/adapters/react-router/v7";
import { RouterProvider } from "react-router-dom";
import { I18nProvider } from "@qarows/ui";
import { AiFeaturesProvider } from "@/context/AiFeaturesContext";
import { ProjectsProvider } from "@/context/ProjectsContext";
import { router } from "@/router";

export function App() {
  return (
    <I18nProvider>
      <NuqsAdapter>
        <AiFeaturesProvider>
          <ProjectsProvider>
            <RouterProvider router={router} />
          </ProjectsProvider>
        </AiFeaturesProvider>
      </NuqsAdapter>
    </I18nProvider>
  );
}

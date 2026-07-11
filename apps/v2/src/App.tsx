import { NuqsAdapter } from "nuqs/adapters/react-router/v7";
import { RouterProvider } from "react-router-dom";
import { AiFeaturesProvider } from "@/context/AiFeaturesContext";
import { ProjectsProvider } from "@/context/ProjectsContext";
import { router } from "@/router";

export function App() {
  return (
    <NuqsAdapter>
      <AiFeaturesProvider>
        <ProjectsProvider>
          <RouterProvider router={router} />
        </ProjectsProvider>
      </AiFeaturesProvider>
    </NuqsAdapter>
  );
}

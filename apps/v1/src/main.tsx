import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { RouterProvider } from "react-router-dom";
import { NuqsAdapter } from "nuqs/adapters/react-router/v7";
import { I18nProvider } from "@qarows/ui";
import { AppProvider } from "@/context/AppContext";
import { router } from "@/router";
import "@/styles/global.css";

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <I18nProvider>
      <AppProvider>
        <NuqsAdapter>
          <RouterProvider router={router} />
        </NuqsAdapter>
      </AppProvider>
    </I18nProvider>
  </StrictMode>,
);

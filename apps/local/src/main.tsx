import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { RouterProvider } from "react-router-dom";
import { NuqsAdapter } from "nuqs/adapters/react-router/v7";
import { ConfirmProvider, I18nProvider, installStaleChunkReload, UpdateAvailableBanner } from "@qarows/ui";
import { AppProvider } from "@/context/AppContext";
import { router } from "@/router";
import "@/styles/global.css";

installStaleChunkReload();

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <I18nProvider>
      <ConfirmProvider>
        <AppProvider>
          <NuqsAdapter>
            <RouterProvider router={router} />
          </NuqsAdapter>
          <UpdateAvailableBanner />
        </AppProvider>
      </ConfirmProvider>
    </I18nProvider>
  </StrictMode>,
);

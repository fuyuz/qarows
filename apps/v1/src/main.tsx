import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { RouterProvider } from "react-router-dom";
import { NuqsAdapter } from "nuqs/adapters/react-router/v7";
import { AppProvider } from "@/context/AppContext";
import { router } from "@/router";
import "@/styles/global.css";

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <AppProvider>
      <NuqsAdapter>
        <RouterProvider router={router} />
      </NuqsAdapter>
    </AppProvider>
  </StrictMode>,
);

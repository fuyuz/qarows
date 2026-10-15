import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { installStaleChunkReload } from "@qarows/ui";
import { App } from "./App";
import "./styles/global.css";

installStaleChunkReload();

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);

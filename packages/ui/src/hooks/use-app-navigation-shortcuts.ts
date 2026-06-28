import { useEffect } from "react";
import type { NavigateFunction } from "react-router-dom";
import { isValidSession, type SessionConfig } from "@qarows/shared";
import type { WorkspaceProjectPage } from "../components/workspace/workspace-app-nav";
import { isKeyboardTypingTarget, matchAppNavigationPage } from "../lib/app-keybindings";

const DEFAULT_AVAILABLE_PAGES: WorkspaceProjectPage[] = [
  "session",
  "run",
  "matrix",
  "dashboard",
  "bugs",
];

export interface UseAppNavigationShortcutsOptions {
  enabled: boolean;
  navigate: NavigateFunction;
  path: (page: WorkspaceProjectPage) => string;
  session: SessionConfig | null;
  availablePages?: readonly WorkspaceProjectPage[];
}

export function useAppNavigationShortcuts({
  enabled,
  navigate,
  path,
  session,
  availablePages = DEFAULT_AVAILABLE_PAGES,
}: UseAppNavigationShortcutsOptions): void {
  useEffect(() => {
    if (!enabled) return;

    const pageSet = new Set(availablePages);

    const onKeyDown = (event: KeyboardEvent) => {
      if (isKeyboardTypingTarget(event.target)) return;

      const page = matchAppNavigationPage(event);
      if (!page || !pageSet.has(page)) return;
      if (page === "run" && (!session || !isValidSession(session))) return;

      event.preventDefault();
      navigate(path(page));
    };

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [availablePages, enabled, navigate, path, session]);
}

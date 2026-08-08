import { APP_NAV_LABELS, appNavLabel, type WorkspaceProjectPage } from "./app-keybindings";
import type { TranslateFn } from "@qarows/shared";

const PROJECT_PAGE_KEYS = new Set<string>(
  Object.keys(APP_NAV_LABELS).filter((key) => key !== "projects"),
);

function decodePathSegment(segment: string): string {
  try {
    return decodeURIComponent(segment);
  } catch {
    return segment;
  }
}

export function formatDocumentTitle(parts: {
  brand: string;
  screen?: string | null;
  projectName?: string | null;
}): string {
  return [parts.screen, parts.projectName, parts.brand]
    .map((part) => part?.trim())
    .filter((part): part is string => Boolean(part))
    .join(" | ");
}

/** `/p/:projectId/...` から projectId を取り出す（なければ null） */
export function projectIdFromPathname(pathname: string): string | null {
  const normalized = pathname.replace(/\/+$/, "") || "/";
  const match = normalized.match(/^\/p\/([^/]+)/);
  if (!match) return null;
  return decodePathSegment(match[1]);
}

/** `/projects` or `/p/:id/:page` → 画面ラベル。それ以外は null（ブランドのみ）。 */
export function screenLabelFromPathname(pathname: string, t?: TranslateFn): string | null {
  const normalized = pathname.replace(/\/+$/, "") || "/";
  if (normalized === "/projects") {
    return t ? appNavLabel("projects", t) : APP_NAV_LABELS.projects;
  }

  const projectMatch = normalized.match(/^\/p\/[^/]+\/([^/]+)$/);
  if (!projectMatch) return null;

  const page = decodePathSegment(projectMatch[1]);
  if (!PROJECT_PAGE_KEYS.has(page)) return null;
  const key = page as WorkspaceProjectPage;
  return t ? appNavLabel(key, t) : APP_NAV_LABELS[key];
}

export function isProjectWorkspacePath(pathname: string): boolean {
  return projectIdFromPathname(pathname) != null;
}

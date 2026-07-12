import { useEffect } from "react";
import { useLocation } from "react-router-dom";
import {
  formatDocumentTitle,
  isProjectWorkspacePath,
  screenLabelFromPathname,
} from "../lib/document-title";

export interface DocumentTitleSyncProps {
  brand: string;
  projectName?: string | null;
  /** false のとき document.title を更新しない（他コンポーネントが担当するとき用） */
  enabled?: boolean;
}

/** Router 配下で pathname / プロジェクト名に応じて document.title を更新する */
export function DocumentTitleSync({
  brand,
  projectName,
  enabled = true,
}: DocumentTitleSyncProps) {
  const { pathname } = useLocation();

  useEffect(() => {
    if (!enabled) return;
    const screen = screenLabelFromPathname(pathname);
    const includeProject = isProjectWorkspacePath(pathname);
    document.title = formatDocumentTitle({
      brand,
      screen,
      projectName: includeProject ? projectName : null,
    });
  }, [brand, enabled, pathname, projectName]);

  return null;
}

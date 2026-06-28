import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { Compass } from "lucide-react";
import { useLocation, useNavigate } from "react-router-dom";
import { isValidSession, type ResultsFile, type SessionConfig, type TestDefinition } from "@qarows/shared";
import { useAppNavigationShortcuts } from "../../hooks/use-app-navigation-shortcuts";
import { formatAppNavShortcutForPage, type AppNavigationPage } from "../../lib/app-keybindings";
import { Button } from "../ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuShortcut,
  DropdownMenuTrigger,
} from "../ui/dropdown-menu";

export type WorkspaceProjectPage = AppNavigationPage;

interface NavLinkItem {
  label: string;
  to: string;
  page?: WorkspaceProjectPage;
}

export interface WorkspaceAppNavProps {
  definition: TestDefinition | null;
  session: SessionConfig | null;
  results?: ResultsFile | null;
  path: (page: WorkspaceProjectPage) => string;
  /** ナビに表示してよいプロジェクト内ページ。未指定時は Phase1 相当の全ページ */
  availablePages?: readonly WorkspaceProjectPage[];
  onExportYaml?: () => void;
  onExportResults?: () => void;
  /** Phase2: 同期状態など、Compass メニュー横に表示するスロット */
  statusSlot?: ReactNode;
}

const DEFAULT_AVAILABLE_PAGES: WorkspaceProjectPage[] = [
  "session",
  "run",
  "matrix",
  "dashboard",
  "bugs",
];

const VIEW_PAGE_LABELS: Record<"dashboard" | "bugs" | "matrix", string> = {
  dashboard: "ダッシュボード",
  bugs: "バグ",
  matrix: "マトリクス",
};

function availablePageSet(pages?: readonly WorkspaceProjectPage[]): Set<WorkspaceProjectPage> {
  return new Set(pages ?? DEFAULT_AVAILABLE_PAGES);
}

function workflowLinks(
  path: WorkspaceAppNavProps["path"],
  page: WorkspaceProjectPage | "load" | "projects" | null,
  session: SessionConfig | null,
  availablePages: Set<WorkspaceProjectPage>,
): NavLinkItem[] {
  const items: NavLinkItem[] = [
    { label: "トップ", to: "/" },
    { label: "プロジェクト一覧", to: "/projects" },
  ];

  const canSession = availablePages.has("session");
  const canRun = availablePages.has("run");

  if (page === "run" && canSession) {
    items.push({ label: "セッション設定", to: path("session"), page: "session" });
  } else if (page === "session" && canRun && session && isValidSession(session)) {
    items.push({ label: "テスト実行", to: path("run"), page: "run" });
  } else if (
    (page === "matrix" || page === "dashboard" || page === "bugs") &&
    availablePages.has(page)
  ) {
    if (canSession) {
      items.push({ label: "セッション設定", to: path("session"), page: "session" });
    }
    if (canRun && session && isValidSession(session)) {
      items.push({ label: "テスト実行", to: path("run"), page: "run" });
    }
  }

  return items;
}

function viewLinks(
  path: WorkspaceAppNavProps["path"],
  availablePages: Set<WorkspaceProjectPage>,
): NavLinkItem[] {
  return (["dashboard", "bugs", "matrix"] as const).flatMap((page) =>
    availablePages.has(page)
      ? [{ label: VIEW_PAGE_LABELS[page], to: path(page), page }]
      : [],
  );
}

function currentProjectPage(pathname: string): WorkspaceProjectPage | "load" | "projects" | null {
  const match = pathname.match(/^\/p\/[^/]+\/(session|run|matrix|dashboard|bugs)$/);
  if (match) return match[1] as WorkspaceProjectPage;
  if (pathname === "/load") return "load";
  if (pathname === "/projects") return "projects";
  return null;
}

export function WorkspaceAppNav({
  definition,
  session,
  results,
  path,
  availablePages,
  onExportYaml,
  onExportResults,
  statusSlot,
}: WorkspaceAppNavProps) {
  const location = useLocation();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);

  const pageSet = useMemo(() => availablePageSet(availablePages), [availablePages]);
  const page = currentProjectPage(location.pathname);

  const workflow = useMemo(
    () => (definition ? workflowLinks(path, page, session, pageSet) : []),
    [definition, page, path, session, pageSet],
  );

  const browseLinks = useMemo(
    () => (definition ? viewLinks(path, pageSet) : []),
    [definition, path, pageSet],
  );

  const canExportResults = definition != null && results != null && onExportResults != null;
  const canExportYaml = definition != null && onExportYaml != null;

  useEffect(() => {
    setOpen(false);
  }, [location.pathname]);

  useAppNavigationShortcuts({
    enabled: definition != null,
    navigate,
    path,
    session,
    availablePages,
  });

  if (!definition) return null;

  const hasWorkflow = workflow.length > 0;
  const hasBrowse = browseLinks.length > 0;

  return (
    <div ref={rootRef} className="fixed top-3.5 right-5 z-40 flex items-center gap-2">
      {statusSlot}
      <DropdownMenu open={open} onOpenChange={setOpen}>
        <DropdownMenuTrigger asChild>
          <Button
            variant="outline"
            size="icon"
            className="size-9 rounded-full shadow-sm"
            aria-label="ナビゲーション"
          >
            <Compass className="size-4.5" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="min-w-44">
          {hasWorkflow && (
            <>
              <DropdownMenuLabel className="text-xs uppercase tracking-wide text-muted-foreground">
                移動
              </DropdownMenuLabel>
              {workflow.map((link) => (
                <DropdownMenuItem
                  key={link.to}
                  onSelect={(event) => {
                    event.preventDefault();
                    setOpen(false);
                    navigate(link.to);
                  }}
                >
                  {link.label}
                  {link.page ? (
                    <DropdownMenuShortcut>{formatAppNavShortcutForPage(link.page)}</DropdownMenuShortcut>
                  ) : null}
                </DropdownMenuItem>
              ))}
            </>
          )}

          {hasBrowse && (
            <>
              <DropdownMenuLabel className="text-xs uppercase tracking-wide text-muted-foreground">
                閲覧
              </DropdownMenuLabel>
              {browseLinks.map((link) => (
                <DropdownMenuItem
                  key={link.to}
                  onSelect={(event) => {
                    event.preventDefault();
                    setOpen(false);
                    navigate(link.to);
                  }}
                >
                  {link.label}
                  {link.page ? (
                    <DropdownMenuShortcut>{formatAppNavShortcutForPage(link.page)}</DropdownMenuShortcut>
                  ) : null}
                </DropdownMenuItem>
              ))}
            </>
          )}

          {(canExportYaml || canExportResults) && (
            <>
              <DropdownMenuSeparator />
              <DropdownMenuLabel className="text-xs uppercase tracking-wide text-muted-foreground">
                データ
              </DropdownMenuLabel>
              {canExportYaml && (
                <DropdownMenuItem
                  onSelect={() => {
                    onExportYaml?.();
                    setOpen(false);
                  }}
                >
                  tests.yml をエクスポート
                </DropdownMenuItem>
              )}
              {canExportResults && (
                <DropdownMenuItem
                  onSelect={() => {
                    onExportResults?.();
                    setOpen(false);
                  }}
                >
                  results.json をエクスポート
                </DropdownMenuItem>
              )}
            </>
          )}
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}

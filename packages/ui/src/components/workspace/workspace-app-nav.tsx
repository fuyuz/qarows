import { useEffect, useMemo, useRef, useState, type CSSProperties } from "react";
import { Compass } from "lucide-react";
import { useLocation, useNavigate } from "react-router-dom";
import { isValidSession, type ResultsFile, type SessionConfig, type TestDefinition } from "@qarows/shared";
import { useAppNavigationShortcuts } from "../../hooks/use-app-navigation-shortcuts";
import {
  appNavLabel,
  formatAppNavShortcutForPage,
  type AppNavigationPage,
  type WorkspaceProjectPage,
} from "../../lib/app-keybindings";
import { cn } from "../../lib/cn";
import { useTranslation } from "../../i18n/context";
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
import {
  SyncConnectionIndicator,
  SyncStatusMenuSection,
  type WorkspaceSyncStatus,
} from "./sync-status-badge";

interface NavLinkItem {
  label: string;
  to: string;
  page?: AppNavigationPage;
}

export interface WorkspaceAppNavExtraMenuItem {
  label: string;
  to: string;
}

export interface WorkspaceAppNavProps {
  definition: TestDefinition | null;
  session: SessionConfig | null;
  results?: ResultsFile | null;
  path: (page: WorkspaceProjectPage) => string;
  /** ナビに表示してよいプロジェクト内ページ。未指定時は Local 版相当の全ページ */
  availablePages?: readonly WorkspaceProjectPage[];
  onExportYaml?: () => void;
  onExportResults?: () => void;
  onExportZip?: () => void;
  /** Team 版: 同期状態（メニュー内表示。切断・再接続時は Compass 横にドット） */
  syncStatus?: WorkspaceSyncStatus;
  /** エディション固有の追加メニュー（例: Team 版 AI 編集） */
  extraMenuItems?: WorkspaceAppNavExtraMenuItem[];
  /**
   * 右端からのオフセット（px）。右サイドパネル（AI など）表示時にナビが重ならないようずらす。
   * 未指定時は `right-5`（20px）。
   */
  offsetRight?: number;
}

const DEFAULT_AVAILABLE_PAGES: WorkspaceProjectPage[] = [
  "session",
  "run",
  "matrix",
  "dashboard",
  "bugs",
  "tests",
];

function availablePageSet(pages?: readonly WorkspaceProjectPage[]): Set<WorkspaceProjectPage> {
  return new Set(pages ?? DEFAULT_AVAILABLE_PAGES);
}

type NavContextPage = WorkspaceProjectPage | "load" | "projects" | null;

function workflowLinks(
  path: WorkspaceAppNavProps["path"],
  page: NavContextPage,
  session: SessionConfig | null,
  availablePages: Set<WorkspaceProjectPage>,
  t: (key: string) => string,
): NavLinkItem[] {
  const items: NavLinkItem[] = [
    { label: t("nav.home"), to: "/" },
    { label: appNavLabel("projects", t), to: "/projects", page: "projects" },
  ];

  const canSession = availablePages.has("session");
  const canRun = availablePages.has("run");

  if (page === "run" && canSession) {
    items.push({ label: appNavLabel("session", t), to: path("session"), page: "session" });
  } else if (page === "session" && canRun && session && isValidSession(session)) {
    items.push({ label: appNavLabel("run", t), to: path("run"), page: "run" });
  } else if (
    (page === "matrix" || page === "dashboard" || page === "bugs" || page === "tests") &&
    availablePages.has(page)
  ) {
    if (canSession) {
      items.push({ label: appNavLabel("session", t), to: path("session"), page: "session" });
    }
    if (canRun && session && isValidSession(session)) {
      items.push({ label: appNavLabel("run", t), to: path("run"), page: "run" });
    }
  }

  return items;
}

function viewLinks(
  path: WorkspaceAppNavProps["path"],
  availablePages: Set<WorkspaceProjectPage>,
  t: (key: string) => string,
): NavLinkItem[] {
  return (["dashboard", "bugs", "matrix"] as const).flatMap((page) =>
    availablePages.has(page)
      ? [{ label: appNavLabel(page, t), to: path(page), page }]
      : [],
  );
}

function editLinks(
  path: WorkspaceAppNavProps["path"],
  availablePages: Set<WorkspaceProjectPage>,
  t: (key: string) => string,
): NavLinkItem[] {
  return (["tests"] as const).flatMap((page) =>
    availablePages.has(page)
      ? [{ label: appNavLabel(page, t), to: path(page), page }]
      : [],
  );
}

function currentProjectPage(pathname: string): NavContextPage {
  const match = pathname.match(/^\/p\/[^/]+\/(session|run|matrix|dashboard|bugs|tests)$/);
  if (match) return match[1] as NavContextPage;
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
  onExportZip,
  syncStatus,
  extraMenuItems,
  offsetRight,
}: WorkspaceAppNavProps) {
  const location = useLocation();
  const navigate = useNavigate();
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);

  const pageSet = useMemo(() => availablePageSet(availablePages), [availablePages]);
  const page = currentProjectPage(location.pathname);

  const workflow = useMemo(
    () => (definition ? workflowLinks(path, page, session, pageSet, t) : []),
    [definition, page, path, session, pageSet, t],
  );

  const browseLinks = useMemo(
    () => (definition ? viewLinks(path, pageSet, t) : []),
    [definition, path, pageSet, t],
  );

  const editLinksList = useMemo(
    () => (definition ? editLinks(path, pageSet, t) : []),
    [definition, path, pageSet, t],
  );

  const canExportResults = definition != null && results != null && onExportResults != null;
  const canExportYaml = definition != null && onExportYaml != null;
  const canExportZip = definition != null && onExportZip != null;

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
  const hasEdit = editLinksList.length > 0;
  const hasExtraMenu = (extraMenuItems?.length ?? 0) > 0;

  const rootStyle: CSSProperties | undefined =
    offsetRight != null ? { right: offsetRight } : undefined;

  return (
    <div
      ref={rootRef}
      className={cn(
        "fixed top-3.5 z-40 flex items-center gap-1.5",
        offsetRight == null && "right-5",
      )}
      style={rootStyle}
    >
      {syncStatus ? (
        <SyncConnectionIndicator
          connected={syncStatus.connected}
          connectionStatus={syncStatus.connectionStatus}
          pendingCommands={syncStatus.pendingCommands}
          syncPulseKey={syncStatus.syncPulseKey}
        />
      ) : null}
      <DropdownMenu open={open} onOpenChange={setOpen}>
        <DropdownMenuTrigger asChild>
          <Button
            variant="outline"
            size="icon"
            className="size-9 rounded-full shadow-sm"
            aria-label={t("nav.navigation")}
          >
            <Compass className="size-4.5" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="min-w-44">
          {syncStatus ? (
            <>
              <SyncStatusMenuSection {...syncStatus} />
              <DropdownMenuSeparator />
            </>
          ) : null}
          {hasWorkflow && (
            <>
              <DropdownMenuLabel className="text-xs uppercase tracking-wide text-muted-foreground">
                {t("nav.go")}
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
                {t("nav.view")}
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

          {(hasEdit || hasExtraMenu) && (
            <>
              {(hasWorkflow || hasBrowse) && <DropdownMenuSeparator />}
              <DropdownMenuLabel className="text-xs uppercase tracking-wide text-muted-foreground">
                {t("nav.edit")}
              </DropdownMenuLabel>
              {editLinksList.map((link) => (
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
              {extraMenuItems?.map((link) => (
                <DropdownMenuItem
                  key={link.to}
                  onSelect={(event) => {
                    event.preventDefault();
                    setOpen(false);
                    navigate(link.to);
                  }}
                >
                  {link.label}
                </DropdownMenuItem>
              ))}
            </>
          )}

          {(canExportYaml || canExportResults || canExportZip) && (
            <>
              <DropdownMenuSeparator />
              <DropdownMenuLabel className="text-xs uppercase tracking-wide text-muted-foreground">
                {t("nav.data")}
              </DropdownMenuLabel>
              {canExportYaml && (
                <DropdownMenuItem
                  onSelect={() => {
                    onExportYaml?.();
                    setOpen(false);
                  }}
                >
                  {t("nav.exportYaml")}
                </DropdownMenuItem>
              )}
              {canExportResults && (
                <DropdownMenuItem
                  onSelect={() => {
                    onExportResults?.();
                    setOpen(false);
                  }}
                >
                  {t("nav.exportResults")}
                </DropdownMenuItem>
              )}
              {canExportZip && (
                <DropdownMenuItem
                  onSelect={() => {
                    onExportZip?.();
                    setOpen(false);
                  }}
                >
                  {t("nav.exportZip")}
                </DropdownMenuItem>
              )}
            </>
          )}
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}

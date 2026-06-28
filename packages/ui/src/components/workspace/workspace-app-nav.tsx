import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { Compass } from "lucide-react";
import { useLocation, useNavigate } from "react-router-dom";
import { isValidSession, type ResultsFile, type SessionConfig, type TestDefinition } from "@qarows/shared";
import { Button } from "../ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "../ui/dropdown-menu";

export type WorkspaceProjectPage = "session" | "run" | "matrix" | "dashboard" | "bugs";

interface NavLinkItem {
  label: string;
  to: string;
}

export interface WorkspaceAppNavProps {
  definition: TestDefinition | null;
  session: SessionConfig | null;
  results?: ResultsFile | null;
  path: (page: WorkspaceProjectPage) => string;
  onExportYaml?: () => void;
  onExportResults?: () => void;
  /** Phase2: 同期状態など、Compass メニュー横に表示するスロット */
  statusSlot?: ReactNode;
}

function currentProjectPage(pathname: string): WorkspaceProjectPage | "load" | "projects" | null {
  const match = pathname.match(/^\/p\/[^/]+\/(session|run|matrix|dashboard|bugs)$/);
  if (match) return match[1] as WorkspaceProjectPage;
  if (pathname === "/load") return "load";
  if (pathname === "/projects") return "projects";
  return null;
}

function workflowLinks(
  path: WorkspaceAppNavProps["path"],
  page: WorkspaceProjectPage | "load" | "projects" | null,
  session: SessionConfig | null,
): NavLinkItem[] {
  const items: NavLinkItem[] = [
    { label: "トップ", to: "/" },
    { label: "プロジェクト一覧", to: "/projects" },
  ];

  if (page === "run") {
    items.push({ label: "セッション設定", to: path("session") });
  } else if (page === "session") {
    if (session && isValidSession(session)) {
      items.push({ label: "テスト実行", to: path("run") });
    }
  } else if (page === "matrix" || page === "dashboard" || page === "bugs") {
    items.push({ label: "セッション設定", to: path("session") });
    if (session && isValidSession(session)) {
      items.push({ label: "テスト実行", to: path("run") });
    }
  }

  return items;
}

export function WorkspaceAppNav({
  definition,
  session,
  results,
  path,
  onExportYaml,
  onExportResults,
  statusSlot,
}: WorkspaceAppNavProps) {
  const location = useLocation();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);

  const page = currentProjectPage(location.pathname);

  const workflow = useMemo(
    () => (definition ? workflowLinks(path, page, session) : []),
    [definition, page, path, session],
  );

  const viewLinks = useMemo(
    (): NavLinkItem[] =>
      definition
        ? [
            { label: "ダッシュボード", to: path("dashboard") },
            { label: "バグ", to: path("bugs") },
            { label: "マトリクス", to: path("matrix") },
          ]
        : [],
    [definition, path],
  );

  const canExportResults = definition != null && results != null && onExportResults != null;
  const canExportYaml = definition != null && onExportYaml != null;

  useEffect(() => {
    setOpen(false);
  }, [location.pathname]);

  if (!definition) return null;

  const hasWorkflow = workflow.length > 0;

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
                </DropdownMenuItem>
              ))}
            </>
          )}

          <DropdownMenuLabel className="text-xs uppercase tracking-wide text-muted-foreground">
            閲覧
          </DropdownMenuLabel>
          {viewLinks.map((link) => (
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

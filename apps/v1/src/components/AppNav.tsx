import { useEffect, useMemo, useRef, useState } from "react";
import { Compass } from "lucide-react";
import { useLocation, useNavigate } from "react-router-dom";
import { isValidSession, serializeResultsJson, serializeTestsYaml } from "@qarows/shared";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useApp } from "@/context/AppContext";
import { useProjectRoutes } from "@/hooks/useProjectRoutes";
import { type ProjectPage } from "@/lib/project-routes";
import { downloadText } from "@/lib/utils";

interface NavLinkItem {
  label: string;
  to: string;
}

function currentProjectPage(pathname: string): ProjectPage | "load" | null {
  const match = pathname.match(/^\/p\/[^/]+\/(session|run|matrix|dashboard|bugs)$/);
  if (match) return match[1] as ProjectPage;
  if (pathname === "/load") return "load";
  return null;
}

function workflowLinks(
  path: (page: ProjectPage) => string,
  page: ProjectPage | "load" | null,
  session: ReturnType<typeof useApp>["session"],
): NavLinkItem[] {
  const items: NavLinkItem[] = [];

  if (page === "run") {
    items.push({ label: "セッション設定", to: path("session") });
    items.push({ label: "ファイル読み込み", to: "/load" });
  } else if (page === "session") {
    items.push({ label: "ファイル読み込み", to: "/load" });
    if (session && isValidSession(session)) {
      items.push({ label: "テスト実行", to: path("run") });
    }
  } else if (page === "load") {
    items.push({ label: "セッション設定", to: path("session") });
    if (session && isValidSession(session)) {
      items.push({ label: "テスト実行", to: path("run") });
    }
  } else if (page === "matrix" || page === "dashboard" || page === "bugs") {
    items.push({ label: "ファイル読み込み", to: "/load" });
    items.push({ label: "セッション設定", to: path("session") });
    if (session && isValidSession(session)) {
      items.push({ label: "テスト実行", to: path("run") });
    }
  }

  return items;
}

export function AppNav() {
  const location = useLocation();
  const navigate = useNavigate();
  const { definition, results, session } = useApp();
  const { path } = useProjectRoutes();
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

  const canExportResults = definition != null && results != null;
  const canExportYaml = definition != null;

  useEffect(() => {
    setOpen(false);
  }, [location.pathname]);

  if (!definition) return null;

  const handleExportResults = () => {
    if (!results) return;
    const json = serializeResultsJson(results);
    downloadText(json, "results.json", "application/json");
    setOpen(false);
  };

  const handleExportYaml = () => {
    if (!definition) return;
    const yaml = serializeTestsYaml(definition);
    downloadText(yaml, "tests.yml", "text/yaml");
    setOpen(false);
  };

  const hasWorkflow = workflow.length > 0;

  return (
    <div ref={rootRef} className="fixed top-3.5 right-5 z-40">
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
                <DropdownMenuItem onSelect={handleExportYaml}>
                  tests.yml をエクスポート
                </DropdownMenuItem>
              )}
              {canExportResults && (
                <DropdownMenuItem onSelect={handleExportResults}>
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

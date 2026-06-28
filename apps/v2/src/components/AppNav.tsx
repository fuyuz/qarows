import { Link, useLocation, useParams } from "react-router-dom";
import { Button, SyncStatusBadge } from "@qarows/ui";
import { useProjectSync } from "@/context/ProjectSyncContext";
import { projectPath, projectsHubPath, type ProjectPage } from "@/lib/project-routes";

const NAV_ITEMS: { page: ProjectPage; label: string }[] = [
  { page: "session", label: "セッション" },
  { page: "run", label: "実行" },
];

export function AppNav() {
  const { projectId, page } = useParams<{ projectId: string; page: ProjectPage }>();
  const location = useLocation();
  const { definition, connected, revision } = useProjectSync();

  if (!projectId || !definition) return null;

  return (
    <header className="shrink-0 border-b bg-card/80 px-5 py-3 backdrop-blur">
      <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-3">
        <div className="min-w-0">
          <p className="truncate text-sm font-bold">{definition.project.name}</p>
          <p className="font-mono text-xs text-muted-foreground">{projectId}</p>
        </div>

        <nav className="flex flex-wrap items-center gap-2">
          {NAV_ITEMS.map((item) => {
            const href = projectPath(projectId, item.page);
            const active = page === item.page || location.pathname.endsWith(`/${item.page}`);
            return (
              <Button
                key={item.page}
                asChild
                variant={active ? "default" : "ghost"}
                size="sm"
              >
                <Link to={href}>{item.label}</Link>
              </Button>
            );
          })}
          <Button asChild variant="outline" size="sm">
            <Link to={projectsHubPath(projectId)}>一覧</Link>
          </Button>
        </nav>

        <SyncStatusBadge connected={connected} revision={revision} />
      </div>
    </header>
  );
}

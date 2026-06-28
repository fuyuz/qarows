import { useCallback, useEffect, useMemo, type ReactNode } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { isBugClosed } from "@qarows/shared";
import { Card, CardContent, CardHeader, CardTitle } from "@qarows/ui";
import { CategoryStatsLegend, CategoryStatsTable } from "../components/CategoryStatsTable";
import { ProgressRow } from "../components/ProgressRow";
import { useRunnerWorkspace } from "../context/runner-workspace";
import { useProjectRoutes } from "../hooks/useProjectRoutes";
import {
  computeCategoryProgress,
  computeRunProgress,
  getAllEnvironmentIds,
} from "../lib/run-progress";
import { projectPath } from "../lib/project-routes";

function countOpenBugs(bugs: { status: Parameters<typeof isBugClosed>[0] }[]): number {
  return bugs.filter((bug) => !isBugClosed(bug.status)).length;
}

export function DashboardPageLayout({ nav }: { nav: ReactNode }) {
  const navigate = useNavigate();
  const location = useLocation();
  const { definition, results, session } = useRunnerWorkspace();
  const { projectId, path } = useProjectRoutes();

  useEffect(() => {
    if (!location.search || !projectId) return;
    navigate(projectPath(projectId, "dashboard"), { replace: true });
  }, [location.search, navigate, projectId]);

  const { overallStats, categoryRows } = useMemo(() => {
    if (!definition || !results) {
      return {
        overallStats: {
          total: 0,
          completed: 0,
          buckets: { incomplete: 0, OK: 0, NG: 0, SKIP: 0 },
        },
        categoryRows: [],
      };
    }
    const envIds = getAllEnvironmentIds(definition);
    return {
      overallStats: computeRunProgress(definition, envIds, results.results),
      categoryRows: computeCategoryProgress(definition, envIds, results.results),
    };
  }, [definition, results]);

  const handleMajorCategoryClick = useCallback(
    (major: string) => {
      navigate(
        path("run", {
          targetMode: "filter",
          majorCategoryFilter: major,
          onlyIncomplete: false,
        }),
      );
    },
    [navigate, path],
  );

  if (!definition || !results) return null;

  const envNames = definition.environments.map((e) => e.name).join("、");
  const sessionEnvNames =
    session?.selectedEnvironmentIds
      .map((id) => definition.environments.find((e) => e.id === id)?.name ?? id)
      .join("、") ?? "";

  return (
    <div className="flex min-h-svh flex-col">
      {nav}
      <main className="mx-auto w-full max-w-4xl flex-1 px-5 py-6">
        <h1 className="mb-6 text-lg font-bold tracking-tight">ダッシュボード</h1>

        <section className="mb-8 grid gap-4 sm:grid-cols-2">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-semibold text-muted-foreground">
                プロジェクト
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-1 text-sm">
              <p className="text-base font-bold">{definition.project.name}</p>
              <p>
                <span className="text-muted-foreground">ID:</span> {definition.project.id}
              </p>
              {definition.project.version != null && (
                <p>
                  <span className="text-muted-foreground">version:</span> {definition.project.version}
                </p>
              )}
              <p>
                <span className="text-muted-foreground">テストケース:</span>{" "}
                {definition.testCases.length} 件
              </p>
              <p>
                <span className="text-muted-foreground">環境:</span> {definition.environments.length}{" "}
                （{envNames}）
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-semibold text-muted-foreground">
                バグ・セッション
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-1 text-sm">
              <p>
                <span className="text-muted-foreground">バグ:</span> {results.bugs.length} 件
                {results.bugs.length > 0 && (
                  <span className="text-muted-foreground">
                    （未解決 {countOpenBugs(results.bugs)} 件）
                  </span>
                )}
              </p>
              {session ? (
                <>
                  <p>
                    <span className="text-muted-foreground">実施者:</span> {session.executorName}
                  </p>
                  <p>
                    <span className="text-muted-foreground">選択環境:</span> {sessionEnvNames}
                  </p>
                </>
              ) : (
                <p>
                  <span className="text-muted-foreground">セッション:</span>{" "}
                  <Link to={path("session")} className="font-semibold text-primary hover:underline">
                    未設定 — セッション設定へ
                  </Link>
                </p>
              )}
            </CardContent>
          </Card>
        </section>

        <section className="mb-8">
          <h2 className="mb-3 text-xs font-semibold text-muted-foreground">全体進捗（全環境）</h2>
          <div className="rounded-xl border bg-card px-4 py-3 shadow-sm">
            <ProgressRow id="dashboard-overall" title="全体" stats={overallStats} />
          </div>
        </section>

        <section>
          <div className="mb-3 flex flex-wrap items-end justify-between gap-2">
            <h2 className="text-xs font-semibold text-muted-foreground">大項目別</h2>
            <CategoryStatsLegend />
          </div>
          <CategoryStatsTable rows={categoryRows} onMajorClick={handleMajorCategoryClick} />
        </section>
      </main>
    </div>
  );
}

import { useCallback, useEffect, useMemo, useState, type ReactNode } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { isBugClosed } from "@qarows/shared";
import { useTranslation } from "@qarows/ui";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@qarows/ui";
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

type DashboardScope = "all" | "session";

export function DashboardPageLayout({ nav }: { nav: ReactNode }) {
  const { t, locale } = useTranslation();
  const navigate = useNavigate();
  const location = useLocation();
  const { definition, results, session } = useRunnerWorkspace();
  const { projectId, path } = useProjectRoutes();
  const [scope, setScope] = useState<DashboardScope>("session");
  // セッション未設定時はセッション絞り込みができないため全体に固定
  const effectiveScope: DashboardScope = session ? scope : "all";

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
    const envIds =
      effectiveScope === "session" && session
        ? session.selectedEnvironmentIds
        : getAllEnvironmentIds(definition);
    return {
      overallStats: computeRunProgress(definition, envIds, results.results),
      categoryRows: computeCategoryProgress(definition, envIds, results.results, locale),
    };
  }, [definition, effectiveScope, locale, results, session]);

  const handleMajorCategoryClick = useCallback(
    (major: string) => {
      navigate(
        path("run", {
          targetMode: "filter",
          majorCategoryFilter: major,
          onlyIncomplete: false,
          onlyWithBugs: false,
          onlyWithNg: false,
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
        <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
          <h1 className="text-lg font-bold tracking-tight">{t("nav.dashboard")}</h1>
          <Select
            value={effectiveScope}
            onValueChange={(value) => setScope(value as DashboardScope)}
            disabled={!session}
          >
            <SelectTrigger
              aria-label={t("runner.dashboardScopeAria")}
              className="h-auto w-auto px-2.5 py-1.5 text-sm font-semibold"
            >
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="session">{t("runner.dashboardScopeSession")}</SelectItem>
              <SelectItem value="all">{t("runner.dashboardScopeAll")}</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <section className="mb-8 grid gap-4 sm:grid-cols-2">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-semibold text-muted-foreground">
                {t("definition.project")}
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
                <span className="text-muted-foreground">{t("runner.testCasesLabel")}</span>{" "}
                {t("common.count", { n: definition.testCases.length })}
              </p>
              <p>
                <span className="text-muted-foreground">{t("runner.environmentsLabel")}</span>{" "}
                {definition.environments.length} （{envNames}）
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-semibold text-muted-foreground">
                {t("runner.bugsSession")}
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-1 text-sm">
              <p>
                <span className="text-muted-foreground">{t("runner.bugsLabel")}</span>{" "}
                {t("common.count", { n: results.bugs.length })}
                {results.bugs.length > 0 && (
                  <span className="text-muted-foreground">
                    {t("runner.openCount", { n: countOpenBugs(results.bugs) })}
                  </span>
                )}
              </p>
              {session ? (
                <>
                  <p>
                    <span className="text-muted-foreground">{t("runner.executorLabel")}</span> {session.executorName}
                  </p>
                  <p>
                    <span className="text-muted-foreground">{t("runner.selectedEnvs")}</span> {sessionEnvNames}
                  </p>
                </>
              ) : (
                <p>
                  <span className="text-muted-foreground">{t("runner.sessionLabel")}</span>{" "}
                  <Link to={path("session")} className="font-semibold text-primary hover:underline">
                    {t("session.notSet")}
                  </Link>
                </p>
              )}
            </CardContent>
          </Card>
        </section>

        <section className="mb-8">
          <h2 className="mb-3 text-xs font-semibold text-muted-foreground">
            {t(effectiveScope === "session" ? "runner.sessionProgress" : "runner.overallProgress")}
          </h2>
          <div className="rounded-xl border bg-card px-4 py-3 shadow-sm">
            <ProgressRow id="dashboard-overall" title={t("common.overall")} stats={overallStats} />
          </div>
        </section>

        <section>
          <div className="mb-3 flex flex-wrap items-end justify-between gap-2">
            <h2 className="text-xs font-semibold text-muted-foreground">{t("runner.byMajor")}</h2>
            <CategoryStatsLegend />
          </div>
          <CategoryStatsTable rows={categoryRows} onMajorClick={handleMajorCategoryClick} />
        </section>
      </main>
    </div>
  );
}

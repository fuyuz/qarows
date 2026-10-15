import { useMemo, type ReactNode } from "react";
import { Link } from "react-router-dom";
import { parseAsBoolean, parseAsStringLiteral, useQueryStates } from "nuqs";
import { isValidSession } from "@qarows/shared";
import {
  Checkbox,
  Label,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  useTranslation,
} from "@qarows/ui";
import { RunnerFilterBar } from "../components/RunnerFilterBar";
import { TestMatrixTable } from "../components/TestMatrixTable";
import { useRunnerWorkspace } from "../context/runner-workspace";
import { useProjectRoutes } from "../hooks/useProjectRoutes";
import { useRunnerQueryState } from "../hooks/useRunnerQueryState";
import { getAllEnvironmentIds } from "../lib/run-progress";
import { resolveMatrixTestCases } from "../lib/matrix-test-cases";

const MATRIX_SCOPES = ["session", "all"] as const;
type MatrixScope = (typeof MATRIX_SCOPES)[number];

/** 表示対象とコンパクト表示は URL に残す（リロード・共有しても同じ表示になる） */
const matrixViewParsers = {
  scope: parseAsStringLiteral(MATRIX_SCOPES).withDefault("session"),
  compact: parseAsBoolean.withDefault(true),
};

export function MatrixPageLayout({ nav }: { nav: ReactNode }) {
  const { t } = useTranslation();
  const { definition, results, session: rawSession } = useRunnerWorkspace();
  const { runnerFilters } = useRunnerQueryState();
  const { path } = useProjectRoutes();
  const [{ scope, compact }, setView] = useQueryStates(matrixViewParsers);
  // 端末を選ぶ前の（開始していない）セッションは未設定と同じ扱いにする
  const session = rawSession && isValidSession(rawSession) ? rawSession : null;
  // セッション未設定時はセッション絞り込みができないため全体に固定
  const effectiveScope: MatrixScope = session ? scope : "all";

  // 同期で session が作り直されても中身が同じなら同じ配列を返す（列定義の作り直しを防ぐ）
  const environmentIdsKey = !definition
    ? ""
    : (effectiveScope === "session" && session
        ? session.selectedEnvironmentIds
        : getAllEnvironmentIds(definition)
      ).join("\n");
  const environmentIds = useMemo(
    () => (environmentIdsKey ? environmentIdsKey.split("\n") : []),
    [environmentIdsKey],
  );

  const testCases = useMemo(() => {
    if (!definition || !results) return [];
    return resolveMatrixTestCases(
      definition,
      runnerFilters,
      results.results,
      environmentIds,
      effectiveScope === "session" ? session : null,
      results.bugs,
    );
  }, [definition, effectiveScope, environmentIds, results, runnerFilters, session]);

  if (!definition || !results) return null;

  return (
    <div className="flex h-svh flex-col overflow-hidden">
      {nav}
      <RunnerFilterBar className="shrink-0 z-10" maxWidthClass="max-w-[min(100%,1400px)]" />
      <main className="mx-auto flex min-h-0 w-full max-w-[min(100%,1400px)] flex-1 flex-col overflow-hidden px-5 py-4">
        <div className="shrink-0">
          <div className="mb-1 flex flex-wrap items-center justify-between gap-3">
            <h1 className="text-lg font-bold tracking-tight">{t("nav.matrix")}</h1>
            <div className="flex items-center gap-4">
              <Label className="flex cursor-pointer items-center gap-2 text-sm font-medium">
                <Checkbox checked={compact} onCheckedChange={(value) => void setView({ compact: value === true })} />
                {t("runner.matrixCompact")}
              </Label>
              <Select
                value={effectiveScope}
                onValueChange={(value) => void setView({ scope: value as MatrixScope })}
                disabled={!session}
              >
                <SelectTrigger
                  aria-label={t("runner.matrixScopeAria")}
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
          </div>
          <p className="mb-1 text-xs text-muted-foreground">{t("runner.matrixHint")}</p>
          <p className="mb-3 text-xs">
            {session ? (
              <>
                <span className="text-muted-foreground">{t("runner.executorLabel")}</span> {session.executorName}
              </>
            ) : (
              <>
                <span className="text-muted-foreground">{t("runner.sessionLabel")}</span>{" "}
                <Link to={path("session")} className="font-semibold text-primary hover:underline">
                  {t("session.notSet")}
                </Link>
              </>
            )}
          </p>
        </div>
        <div className="min-h-0 flex-1">
          <TestMatrixTable testCases={testCases} environmentIds={environmentIds} compact={compact} />
        </div>
      </main>
    </div>
  );
}

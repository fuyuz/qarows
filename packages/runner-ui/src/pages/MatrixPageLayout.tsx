import { useMemo, useState, type ReactNode } from "react";
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
import { useRunnerQueryState } from "../hooks/useRunnerQueryState";
import { getAllEnvironmentIds } from "../lib/run-progress";
import { resolveMatrixTestCases } from "../lib/matrix-test-cases";

type MatrixScope = "all" | "session";

export function MatrixPageLayout({ nav }: { nav: ReactNode }) {
  const { t } = useTranslation();
  const { definition, results, session } = useRunnerWorkspace();
  const { runnerFilters } = useRunnerQueryState();
  const [scope, setScope] = useState<MatrixScope>("session");
  const [compact, setCompact] = useState(true);
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
                <Checkbox checked={compact} onCheckedChange={(value) => setCompact(value === true)} />
                {t("runner.matrixCompact")}
              </Label>
              <Select
                value={effectiveScope}
                onValueChange={(value) => setScope(value as MatrixScope)}
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
              <span className="text-muted-foreground">{t("runner.sessionRequired")}</span>
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

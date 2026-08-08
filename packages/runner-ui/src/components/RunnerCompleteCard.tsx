import { useNavigate } from "react-router-dom";
import { useTranslation } from "@qarows/ui";
import { RunnerCardFooter, testCardShellClass, type RunnerCardNavProps } from "./RunnerCardFooter";
import { Badge } from "@qarows/ui";
import { Button } from "@qarows/ui";
import { useProjectRoutes } from "../hooks/useProjectRoutes";

export function RunnerCompleteCard({
  testCount,
  ...navProps
}: { testCount: number } & RunnerCardNavProps) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { path } = useProjectRoutes();

  return (
    <article className={testCardShellClass("border-green-200/80 bg-green-50/30")}>
      <div className="min-h-0 flex-1 overflow-y-auto pb-3">
        <header className="mb-5 flex flex-wrap items-baseline gap-x-3 gap-y-1 border-b pb-3.5">
          <Badge className="border-transparent bg-green-100 font-bold text-green-800 hover:bg-green-100">
            {t("runner.completeTitle")}
          </Badge>
          <span className="text-sm text-muted-foreground">{t("runner.scopeComplete")}</span>
        </header>

        <section className="mb-5">
          <h2 className="mb-1.5 text-xs font-semibold tracking-wide text-muted-foreground uppercase">
            {t("runner.inputComplete")}
          </h2>
          <p className="text-base leading-relaxed font-medium">
            {testCount > 0
              ? t("runner.allRecorded", { n: testCount })
              : t("runner.noTestsInScope")}
          </p>
        </section>

        <section className="mb-5">
          <h2 className="mb-1.5 text-xs font-semibold tracking-wide text-muted-foreground uppercase">
            {t("runner.nextSteps")}
          </h2>
          <p className="text-sm text-muted-foreground">{t("runner.completeNextStepsBody")}</p>
        </section>

        <section className="flex flex-wrap gap-2">
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="font-semibold"
            onClick={() => navigate(path("session"))}
          >
            {t("runner.goToSession")}
          </Button>
        </section>
      </div>

      <RunnerCardFooter {...navProps} mode="complete" />
    </article>
  );
}

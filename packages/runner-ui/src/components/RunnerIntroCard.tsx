import { formatRunnerKeys, RUNNER_KEYBINDINGS } from "../lib/runner-keybindings";
import { useTranslation } from "@qarows/ui";
import { Kbd } from "@qarows/ui";
import { RunnerCardFooter, testCardShellClass, type RunnerCardNavProps } from "./RunnerCardFooter";
import { Badge } from "@qarows/ui";

export function RunnerIntroCard(props: RunnerCardNavProps) {
  const { t } = useTranslation();

  return (
    <article className={testCardShellClass()}>
      <div className="min-h-0 flex-1 overflow-y-auto pb-3">
        <header className="mb-5 flex flex-wrap items-baseline gap-x-3 gap-y-1 border-b pb-3.5">
          <Badge variant="secondary" className="font-bold">
            START
          </Badge>
          <span className="text-sm text-muted-foreground">{t("runner.introTitle")}</span>
        </header>

        <section className="mb-5">
          <h2 className="mb-1.5 text-xs font-semibold tracking-wide text-muted-foreground uppercase">
            {t("runner.introHeading")}
          </h2>
          <p className="text-base leading-relaxed font-medium">
            {t("runner.introHowToBody", {
              nextKeys: formatRunnerKeys(RUNNER_KEYBINDINGS.next),
            })}
          </p>
          <p className="mt-2 text-sm text-muted-foreground">
            {t("runner.introBatchKeysHint", {
              okKeys: formatRunnerKeys(RUNNER_KEYBINDINGS.ok),
            })}
          </p>
        </section>

        <section className="mb-5">
          <h2 className="mb-1.5 text-xs font-semibold tracking-wide text-muted-foreground uppercase">
            {t("runner.introResults")}
          </h2>
          <ul className="mb-3 flex flex-col gap-2">
            <li className="flex items-center gap-2.5 text-sm">
              <Kbd>{formatRunnerKeys(RUNNER_KEYBINDINGS.ok)}</Kbd>
              <span>{t("runner.batchOk")}</span>
            </li>
            <li className="flex items-center gap-2.5 text-sm">
              <Kbd>{formatRunnerKeys(RUNNER_KEYBINDINGS.ng)}</Kbd>
              <span>{t("runner.batchNg")}</span>
            </li>
            <li className="flex items-center gap-2.5 text-sm">
              <Kbd>{formatRunnerKeys(RUNNER_KEYBINDINGS.skip)}</Kbd>
              <span>{t("runner.batchSkip")}</span>
            </li>
          </ul>
          <p className="text-sm text-muted-foreground">{t("runner.introPerDeviceHint")}</p>
        </section>

        <section className="mb-5">
          <h2 className="mb-1.5 text-xs font-semibold tracking-wide text-muted-foreground uppercase">
            {t("runner.introOther")}
          </h2>
          <p className="text-sm text-muted-foreground">{t("runner.introShortcutsHint")}</p>
        </section>
      </div>

      <RunnerCardFooter {...props} mode="intro" />
    </article>
  );
}

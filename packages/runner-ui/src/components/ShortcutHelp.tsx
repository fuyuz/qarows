import {
  APP_NAV_LABELS,
  APP_NAV_PAGES,
  formatAppNavShortcutForPage,
  useTranslation,
  type AppNavigationPage,
} from "@qarows/ui";
import { Kbd, Button } from "@qarows/ui";
import { formatRunnerKeys, RUNNER_KEYBINDINGS } from "../lib/runner-keybindings";

const DEFAULT_NAV_PAGES: AppNavigationPage[] = APP_NAV_PAGES;

export function ShortcutHelp({
  availableNavPages = DEFAULT_NAV_PAGES,
}: {
  availableNavPages?: readonly AppNavigationPage[];
}) {
  const { t } = useTranslation();
  const navPages = APP_NAV_PAGES.filter(
    (page) => page === "projects" || availableNavPages.includes(page),
  );

  const runnerShortcutRows = [
    { label: t("runner.prevTest"), keys: RUNNER_KEYBINDINGS.prev },
    { label: t("runner.nextTest"), keys: RUNNER_KEYBINDINGS.next },
    { label: t("runner.batchOk"), keys: RUNNER_KEYBINDINGS.ok },
    { label: t("runner.batchNg"), keys: RUNNER_KEYBINDINGS.ng },
    { label: t("runner.batchSkip"), keys: RUNNER_KEYBINDINGS.skip },
  ] as const;

  return (
    <div className="group fixed right-5 bottom-20 z-30">
      <Button
        variant="outline"
        size="icon"
        className="size-9 rounded-full text-base font-bold shadow-sm"
        aria-label={t("runner.shortcuts")}
        aria-describedby="shortcut-help-panel"
      >
        ?
      </Button>
      <div
        id="shortcut-help-panel"
        role="tooltip"
        className="pointer-events-none absolute right-0 bottom-[calc(100%+0.5rem)] hidden min-w-56 rounded-lg border bg-popover px-4 py-3 text-popover-foreground shadow-md group-focus-within:block group-hover:block"
      >
        <p className="mb-2.5 text-sm font-semibold">{t("runner.shortcuts")}</p>
        <dl className="space-y-2">
          {runnerShortcutRows.map((row) => (
            <div key={row.label} className="flex items-center justify-between gap-4 text-sm">
              <dt className="text-muted-foreground">{row.label}</dt>
              <dd>
                <Kbd>{formatRunnerKeys(row.keys)}</Kbd>
              </dd>
            </div>
          ))}
        </dl>
        {navPages.length > 0 && (
          <>
            <p className="mt-3 mb-2 text-xs font-semibold tracking-wide text-muted-foreground uppercase">
              {t("runner.shortcutsNav")}
            </p>
            <dl className="space-y-2">
              {navPages.map((page) => (
                <div key={page} className="flex items-center justify-between gap-4 text-sm">
                  <dt className="text-muted-foreground">{APP_NAV_LABELS[page]}</dt>
                  <dd>
                    <Kbd>{formatAppNavShortcutForPage(page)}</Kbd>
                  </dd>
                </div>
              ))}
            </dl>
          </>
        )}
        <p className="mt-2.5 border-t pt-2.5 text-xs text-muted-foreground">
          {t("runner.shortcutsDisabledMemo")}
        </p>
      </div>
    </div>
  );
}

import { useEffect, useState } from "react";
import { RefreshCw, X } from "lucide-react";
import { useTranslation } from "../i18n/context";
import { currentBuildId, fetchLatestBuildId } from "../lib/stale-build";
import { Button } from "./ui/button";

const CHECK_INTERVAL_MS = 10 * 60_000;

/** 新しいビルドが公開されたら画面下に再読み込みの案内を出す（入力中の内容を失わないよう自動では再読み込みしない） */
export function UpdateAvailableBanner() {
  const { t } = useTranslation();
  const [available, setAvailable] = useState(false);
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    const buildId = currentBuildId();
    if (!buildId) return;

    let cancelled = false;
    const check = async () => {
      if (document.visibilityState !== "visible") return;
      const latest = await fetchLatestBuildId();
      if (!cancelled && latest && latest !== buildId) setAvailable(true);
    };

    const onVisibility = () => void check();
    document.addEventListener("visibilitychange", onVisibility);
    const timer = window.setInterval(() => void check(), CHECK_INTERVAL_MS);
    return () => {
      cancelled = true;
      document.removeEventListener("visibilitychange", onVisibility);
      window.clearInterval(timer);
    };
  }, []);

  if (!available || dismissed) return null;

  return (
    <div
      role="status"
      className="fixed bottom-16 left-1/2 z-50 flex w-[min(100%-2rem,32rem)] -translate-x-1/2 items-center gap-3 rounded-lg border bg-card px-4 py-3 text-sm shadow-lg"
    >
      <span className="flex-1">{t("update.available")}</span>
      <Button type="button" size="sm" className="gap-1.5" onClick={() => window.location.reload()}>
        <RefreshCw className="size-3.5" aria-hidden />
        {t("update.reload")}
      </Button>
      <button
        type="button"
        className="rounded p-1 text-muted-foreground hover:text-foreground"
        aria-label={t("common.close")}
        title={t("common.close")}
        onClick={() => setDismissed(true)}
      >
        <X className="size-4" aria-hidden />
      </button>
    </div>
  );
}

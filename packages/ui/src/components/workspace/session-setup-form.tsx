import { useState } from "react";
import { Alert, AlertDescription } from "../ui/alert";
import { Button } from "../ui/button";
import { Checkbox } from "../ui/checkbox";
import { Input } from "../ui/input";
import { Label } from "../ui/label";
import { cn } from "../../lib/cn";
import { useTranslation } from "../../i18n/context";

export interface SessionSetupFormProps {
  projectName: string;
  environments: { id: string; name: string }[];
  initialExecutorName?: string;
  initialSelectedEnvIds?: string[];
  onSubmit: (session: {
    executorName: string;
    selectedEnvironmentIds: string[];
  }) => Promise<void>;
  syncError?: string | null;
  disableSubmitUntilValid?: boolean;
  idleSubmitLabel?: string;
  submittingSubmitLabel?: string;
  showEmptyEnvHint?: boolean;
  /** 指定時はログインユーザー等の固定実施者名（入力不可） */
  fixedExecutorName?: string;
}

export function SessionSetupForm({
  projectName,
  environments,
  initialExecutorName = "",
  initialSelectedEnvIds = [],
  onSubmit,
  syncError,
  disableSubmitUntilValid = true,
  idleSubmitLabel,
  submittingSubmitLabel,
  showEmptyEnvHint = true,
  fixedExecutorName,
}: SessionSetupFormProps) {
  const { t } = useTranslation();
  const [executorName, setExecutorName] = useState(fixedExecutorName ?? initialExecutorName);
  const [selectedEnvIds, setSelectedEnvIds] = useState<string[]>(initialSelectedEnvIds);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [shakeExecutor, setShakeExecutor] = useState(false);
  const [shakeEnvs, setShakeEnvs] = useState(false);

  const resolvedExecutorName = (fixedExecutorName ?? executorName).trim();
  const canStart = resolvedExecutorName.length > 0 && selectedEnvIds.length > 0;
  const resolvedIdleSubmitLabel = idleSubmitLabel ?? t("session.startRun");
  const resolvedSubmittingLabel = submittingSubmitLabel ?? t("session.starting");

  const toggleEnv = (envId: string) => {
    setSelectedEnvIds((prev) =>
      prev.includes(envId) ? prev.filter((id) => id !== envId) : [...prev, envId],
    );
    setError(null);
  };

  const selectAllEnvs = () => {
    setSelectedEnvIds(environments.map((env) => env.id));
    setError(null);
  };

  const handleStart = async () => {
    if (!canStart) {
      if (!resolvedExecutorName) {
        setError(t("session.errExecutor"));
        setShakeExecutor(true);
        setTimeout(() => setShakeExecutor(false), 350);
      } else if (selectedEnvIds.length === 0) {
        setError(t("session.errEnvs"));
        setShakeEnvs(true);
        setTimeout(() => setShakeEnvs(false), 350);
      }
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      await onSubmit({
        executorName: resolvedExecutorName,
        selectedEnvironmentIds: selectedEnvIds,
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : t("session.errStartFailed"));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <>
      <header className="mb-8">
        <h1 className="mb-1 text-3xl font-bold tracking-tight">{t("session.title")}</h1>
        <p className="text-sm text-muted-foreground">
          {t("session.subtitle", { name: projectName })}
        </p>
      </header>

      {syncError && (
        <Alert variant="destructive" className="mb-4">
          <AlertDescription>{syncError}</AlertDescription>
        </Alert>
      )}

      <section className="mb-6">
        <Label htmlFor={fixedExecutorName ? undefined : "executor-name"} className="mb-1.5 block">
          {fixedExecutorName ? t("session.executor") : t("session.executorName")}{" "}
          <span className="text-xs font-semibold text-destructive">{t("common.required")}</span>
        </Label>
        {fixedExecutorName ? (
          <p
            id="executor-name"
            className="rounded-md border bg-muted/40 px-3 py-2 text-sm text-foreground"
          >
            {fixedExecutorName}
          </p>
        ) : (
          <Input
            id="executor-name"
            type="text"
            required
            placeholder={t("session.executorPlaceholder")}
            value={executorName}
            className={cn(shakeExecutor && "animate-ui-shake border-destructive ring-destructive/20")}
            onChange={(event) => {
              setExecutorName(event.target.value);
              setError(null);
            }}
          />
        )}
      </section>

      <section className="mb-6">
        <div className="mb-2.5 flex items-center justify-between gap-3">
          <h2 className="text-base font-semibold">
            {t("session.environments")}{" "}
            <span className="text-xs font-semibold text-destructive">
              {t("session.requiredOneOrMore")}
            </span>
          </h2>
          <Button type="button" variant="ghost" size="sm" onClick={selectAllEnvs}>
            {t("session.selectAll")}
          </Button>
        </div>
        <ul className={cn("flex flex-col gap-1.5", shakeEnvs && "animate-ui-shake")}>
          {environments.map((env) => (
            <li key={env.id}>
              <label className="flex cursor-pointer items-center gap-2.5 rounded-lg border bg-card px-3 py-2.5 text-sm">
                <Checkbox
                  checked={selectedEnvIds.includes(env.id)}
                  onCheckedChange={() => toggleEnv(env.id)}
                />
                <span>{env.name}</span>
              </label>
            </li>
          ))}
        </ul>
        {showEmptyEnvHint && selectedEnvIds.length === 0 && (
          <p className="mt-2 text-sm text-amber-700">{t("session.selectOneEnv")}</p>
        )}
      </section>

      {error && (
        <Alert variant="destructive" className="mb-4">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      <footer className="mt-6">
        <Button
          disabled={(disableSubmitUntilValid && !canStart) || submitting}
          className={cn(canStart && !submitting && "shadow-sm")}
          onClick={() => void handleStart()}
        >
          {submitting ? resolvedSubmittingLabel : resolvedIdleSubmitLabel}
        </Button>
      </footer>
    </>
  );
}

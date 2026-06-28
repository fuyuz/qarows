import { useState } from "react";
import { Alert, AlertDescription } from "../ui/alert";
import { Button } from "../ui/button";
import { Checkbox } from "../ui/checkbox";
import { Input } from "../ui/input";
import { Label } from "../ui/label";
import { cn } from "../../lib/cn";

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
  /** Phase1: disable submit until name + env selected. Phase2: allow click to show validation. */
  disableSubmitUntilValid?: boolean;
  idleSubmitLabel?: string;
  submittingSubmitLabel?: string;
  showEmptyEnvHint?: boolean;
}

export function SessionSetupForm({
  projectName,
  environments,
  initialExecutorName = "",
  initialSelectedEnvIds = [],
  onSubmit,
  syncError,
  disableSubmitUntilValid = true,
  idleSubmitLabel = "テスト実行を開始",
  submittingSubmitLabel = "開始中…",
  showEmptyEnvHint = true,
}: SessionSetupFormProps) {
  const [executorName, setExecutorName] = useState(initialExecutorName);
  const [selectedEnvIds, setSelectedEnvIds] = useState<string[]>(initialSelectedEnvIds);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [shakeExecutor, setShakeExecutor] = useState(false);
  const [shakeEnvs, setShakeEnvs] = useState(false);

  const trimmedName = executorName.trim();
  const canStart = trimmedName.length > 0 && selectedEnvIds.length > 0;

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
      if (!trimmedName) {
        setError("実施者名を入力してください");
        setShakeExecutor(true);
        setTimeout(() => setShakeExecutor(false), 350);
      } else if (selectedEnvIds.length === 0) {
        setError("端末/環境を1つ以上選択してください");
        setShakeEnvs(true);
        setTimeout(() => setShakeEnvs(false), 350);
      }
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      await onSubmit({
        executorName: trimmedName,
        selectedEnvironmentIds: selectedEnvIds,
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : "セッション開始に失敗しました");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <>
      <header className="mb-8">
        <h1 className="mb-1 text-3xl font-bold tracking-tight">セッション設定</h1>
        <p className="text-sm text-muted-foreground">
          プロジェクト: {projectName} — 今回の作業対象を選んでください
        </p>
      </header>

      {syncError && (
        <Alert variant="destructive" className="mb-4">
          <AlertDescription>{syncError}</AlertDescription>
        </Alert>
      )}

      <section className="mb-6">
        <Label htmlFor="executor-name" className="mb-1.5 block">
          実施者名 <span className="text-xs font-semibold text-destructive">必須</span>
        </Label>
        <Input
          id="executor-name"
          type="text"
          required
          placeholder="例: tanaka"
          value={executorName}
          className={cn(shakeExecutor && "animate-ui-shake border-destructive ring-destructive/20")}
          onChange={(event) => {
            setExecutorName(event.target.value);
            setError(null);
          }}
        />
      </section>

      <section className="mb-6">
        <div className="mb-2.5 flex items-center justify-between gap-3">
          <h2 className="text-base font-semibold">
            端末 / 環境{" "}
            <span className="text-xs font-semibold text-destructive">必須・1つ以上</span>
          </h2>
          <Button type="button" variant="ghost" size="sm" onClick={selectAllEnvs}>
            すべて選択
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
          <p className="mt-2 text-sm text-amber-700">端末/環境を1つ以上選んでください</p>
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
          {submitting ? submittingSubmitLabel : idleSubmitLabel}
        </Button>
      </footer>
    </>
  );
}

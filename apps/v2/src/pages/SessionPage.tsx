import { useState } from "react";
import { Navigate, useNavigate } from "react-router-dom";
import {
  Alert,
  AlertDescription,
  Button,
  Checkbox,
  cn,
  Input,
  Label,
} from "@qarows/ui";
import { AppNav } from "@/components/AppNav";
import { useProjectSync } from "@/context/ProjectSyncContext";
import { useProjectRoutes } from "@/hooks/useProjectRoutes";

export function SessionPage() {
  const navigate = useNavigate();
  const { ready, definition, session, syncError, setSession } = useProjectSync();
  const { path } = useProjectRoutes();

  const [executorName, setExecutorName] = useState(session?.executorName ?? "");
  const [selectedEnvIds, setSelectedEnvIds] = useState<string[]>(
    session?.selectedEnvironmentIds ?? [],
  );
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [shakeExecutor, setShakeExecutor] = useState(false);
  const [shakeEnvs, setShakeEnvs] = useState(false);

  if (!ready || !definition) {
    return null;
  }

  const trimmedName = executorName.trim();
  const canStart = trimmedName.length > 0 && selectedEnvIds.length > 0;

  const toggleEnv = (envId: string) => {
    setSelectedEnvIds((prev) =>
      prev.includes(envId) ? prev.filter((id) => id !== envId) : [...prev, envId],
    );
    setError(null);
  };

  const selectAllEnvs = () => {
    setSelectedEnvIds(definition.environments.map((e) => e.id));
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
      await setSession({
        executorName: trimmedName,
        selectedEnvironmentIds: selectedEnvIds,
      });
      navigate(path("run"));
    } catch (err) {
      setError(err instanceof Error ? err.message : "セッション開始に失敗しました");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="flex min-h-svh flex-col">
      <AppNav />
      <main className="mx-auto max-w-2xl flex-1 px-5 py-8 pb-12">
        <header className="mb-8">
          <h1 className="mb-1 text-3xl font-bold tracking-tight">セッション設定</h1>
          <p className="text-sm text-muted-foreground">
            プロジェクト: {definition.project.name} — 今回の作業対象を選んでください
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
            {definition.environments.map((env) => (
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
        </section>

        {error && (
          <Alert variant="destructive" className="mb-4">
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        <Button disabled={submitting} onClick={() => void handleStart()}>
          {submitting ? "保存中…" : "テスト実行を開始"}
        </Button>
      </main>
    </div>
  );
}

export function SessionPageRoute() {
  const { ready, definition } = useProjectSync();
  if (!ready) return null;
  if (!definition) return <Navigate to="/projects" replace />;
  return <SessionPage />;
}

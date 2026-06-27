import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { AppNav } from "@/components/AppNav";
import { useApp } from "@/context/AppContext";

export function SessionPage() {
  const navigate = useNavigate();
  const { definition, session, setSession } = useApp();

  const [executorName, setExecutorName] = useState(session?.executorName ?? "");
  const [selectedEnvIds, setSelectedEnvIds] = useState<string[]>(
    session?.selectedEnvironmentIds ?? [],
  );
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  if (!definition) return null;

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
      if (!trimmedName) setError("実施者名を入力してください");
      else if (selectedEnvIds.length === 0) setError("端末/環境を1つ以上選択してください");
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      await setSession({
        executorName: trimmedName,
        selectedEnvironmentIds: selectedEnvIds,
      });
      navigate("/run");
    } catch (err) {
      setError(err instanceof Error ? err.message : "セッション開始に失敗しました");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <>
      <AppNav />
      <main className="page">
      <header className="page__header">
        <h1 className="page__title">セッション設定</h1>
        <p className="page__subtitle">
          プロジェクト: {definition.project.name} — 今回の作業対象を選んでください
        </p>
      </header>

      <section className="form-section">
        <label className="form-label" htmlFor="executor-name">
          実施者名 <span className="form-required">必須</span>
        </label>
        <input
          id="executor-name"
          className="form-input"
          type="text"
          required
          placeholder="例: tanaka"
          value={executorName}
          onChange={(e) => {
            setExecutorName(e.target.value);
            setError(null);
          }}
        />
      </section>

      <section className="form-section">
        <div className="form-section__header">
          <h2 className="form-section__title">
            端末 / 環境 <span className="form-required">必須・1つ以上</span>
          </h2>
          <button type="button" className="btn btn--ghost btn--sm" onClick={selectAllEnvs}>
            すべて選択
          </button>
        </div>
        <ul className="check-list">
          {definition.environments.map((env) => (
            <li key={env.id}>
              <label className="check-item">
                <input
                  type="checkbox"
                  checked={selectedEnvIds.includes(env.id)}
                  onChange={() => toggleEnv(env.id)}
                />
                <span>{env.name}</span>
              </label>
            </li>
          ))}
        </ul>
        {selectedEnvIds.length === 0 && (
          <p className="form-hint form-hint--warn">端末/環境を1つ以上選んでください</p>
        )}
      </section>

      {error && <div className="error-banner">{error}</div>}

      <footer className="page__footer">
        <button
          type="button"
          className="btn btn--primary"
          disabled={!canStart || submitting}
          onClick={() => void handleStart()}
        >
          {submitting ? "開始中…" : "テスト実行を開始"}
        </button>
      </footer>
      </main>
    </>
  );
}

import { useCallback, useEffect, useMemo, useState } from "react";
import { resolveSessionTestTargets, type TestCase, type TestStatus } from "@qarows/shared";
import { useApp } from "@/context/AppContext";
import { filterTestCases } from "@/lib/utils";

const STATUS_LABELS: Record<TestStatus, string> = {
  OK: "OK",
  NG: "NG",
  SKIP: "SKIP",
  OK_NG: "OK→NG",
};

function statusBadgeClass(status: TestStatus): string {
  if (status === "OK_NG") return "status-badge--ok-ng";
  return `status-badge--${status.toLowerCase()}`;
}

function formatCategory(tc: TestCase): string {
  const parts = [tc.category.major];
  if (tc.category.medium) parts.push(tc.category.medium);
  if (tc.category.minor) parts.push(tc.category.minor);
  return parts.join(" › ");
}

export function TestRunner() {
  const {
    definition,
    results,
    session,
    runnerFilters,
    runnerIndex,
    setRunnerIndex,
    updateResults,
    updateResultsBatch,
  } = useApp();

  const [memo, setMemo] = useState("");
  const [busy, setBusy] = useState(false);

  const targets = useMemo(() => {
    if (!definition || !results || !session) return [];
    return filterTestCases(definition, session, runnerFilters, results.results);
  }, [definition, results, session, runnerFilters]);

  const safeIndex = targets.length === 0 ? 0 : Math.min(runnerIndex, targets.length - 1);
  const current = targets[safeIndex];

  const envTargets = useMemo(() => {
    if (!current || !definition || !session) return null;
    return resolveSessionTestTargets(current, definition, session.selectedEnvironmentIds);
  }, [current, definition, session]);

  useEffect(() => {
    if (targets.length > 0 && runnerIndex >= targets.length) {
      void setRunnerIndex(targets.length - 1);
    }
  }, [runnerIndex, setRunnerIndex, targets.length]);

  useEffect(() => {
    if (!current || !results || !envTargets) {
      setMemo("");
      return;
    }
    const byEnv = results.results[current.id] ?? {};
    const existing =
      envTargets.environmentIds.map((id) => byEnv[id]?.memo).find((m) => m != null && m !== "") ??
      "";
    setMemo(existing);
  }, [current, envTargets, results]);

  const goTo = useCallback(
    (index: number) => {
      if (index < 0 || index >= targets.length) return;
      void setRunnerIndex(index);
    },
    [setRunnerIndex, targets.length],
  );

  const applyBatch = useCallback(
    async (status: TestStatus) => {
      if (!current || !envTargets || busy) return;
      setBusy(true);
      try {
        await updateResultsBatch(current.id, envTargets.environmentIds, {
          status,
          memo: memo.trim() || undefined,
        });
        if (safeIndex < targets.length - 1) {
          await setRunnerIndex(safeIndex + 1);
        }
      } finally {
        setBusy(false);
      }
    },
    [
      busy,
      current,
      envTargets,
      memo,
      safeIndex,
      setRunnerIndex,
      targets.length,
      updateResultsBatch,
    ],
  );

  const applySingle = useCallback(
    async (envId: string, status: TestStatus) => {
      if (!current || !session || !envTargets || !results || busy) return;
      setBusy(true);
      try {
        const existing = results.results[current.id]?.[envId];
        await updateResults(current.id, envId, {
          status,
          memo: memo.trim() || existing?.memo,
          executedAt: new Date().toISOString(),
          executedBy: session.executorName,
        });

        const nextByEnv = {
          ...(results.results[current.id] ?? {}),
          [envId]: { status, memo: memo.trim() || existing?.memo },
        };
        const isComplete =
          envTargets.required === "any"
            ? envTargets.environmentIds.some((id) => nextByEnv[id]?.status)
            : envTargets.environmentIds.every((id) => nextByEnv[id]?.status);

        if (isComplete && safeIndex < targets.length - 1) {
          await setRunnerIndex(safeIndex + 1);
        }
      } finally {
        setBusy(false);
      }
    },
    [
      busy,
      current,
      envTargets,
      memo,
      results,
      safeIndex,
      session,
      setRunnerIndex,
      targets.length,
      updateResults,
    ],
  );

  if (!definition || !results || !session) return null;

  if (targets.length === 0) {
    return (
      <div className="runner-empty">
        <p>フィルタ条件に一致するテストがありません。</p>
      </div>
    );
  }

  if (!current || !envTargets) return null;

  return (
    <div className="test-runner">
      <div className="test-runner__nav">
        <button
          type="button"
          className="btn btn--ghost btn--sm"
          disabled={safeIndex === 0 || busy}
          onClick={() => goTo(safeIndex - 1)}
        >
          ← 前へ
        </button>
        <span className="test-runner__position">
          {safeIndex + 1} / {targets.length}
        </span>
        <button
          type="button"
          className="btn btn--ghost btn--sm"
          disabled={safeIndex >= targets.length - 1 || busy}
          onClick={() => goTo(safeIndex + 1)}
        >
          次へ →
        </button>
      </div>

      <article className="test-card">
        <header className="test-card__header">
          <span className="test-card__id">{current.id}</span>
          <span className="test-card__category">{formatCategory(current)}</span>
        </header>

        {current.prerequisites && (
          <section className="test-card__section">
            <h2 className="test-card__label">前提条件</h2>
            <p className="test-card__text">{current.prerequisites}</p>
          </section>
        )}

        <section className="test-card__section">
          <h2 className="test-card__label">確認内容</h2>
          <p className="test-card__text test-card__text--description">{current.description}</p>
        </section>

        <section className="test-card__section">
          <h2 className="test-card__label">
            対象端末
            <span className="test-card__req-badge">
              {envTargets.required === "any" ? "any" : "all"}
            </span>
          </h2>
          <ul className="env-result-list">
            {envTargets.environmentIds.map((envId) => {
              const env = definition.environments.find((e) => e.id === envId);
              const entry = results.results[current.id]?.[envId];
              return (
                <li key={envId} className="env-result-list__item">
                  <div className="env-result-list__info">
                    <span className="env-result-list__name">{env?.name ?? envId}</span>
                    {entry?.status && (
                      <span className={`status-badge ${statusBadgeClass(entry.status)}`}>
                        {STATUS_LABELS[entry.status]}
                      </span>
                    )}
                  </div>
                  <div className="env-result-list__actions">
                    {(["OK", "NG", "SKIP"] as const).map((status) => (
                      <button
                        key={status}
                        type="button"
                        className={`btn btn--sm btn--status btn--status-${status.toLowerCase()}${
                          entry?.status === status ? " btn--status-active" : ""
                        }`}
                        disabled={busy}
                        onClick={() => void applySingle(envId, status)}
                      >
                        {STATUS_LABELS[status]}
                      </button>
                    ))}
                  </div>
                </li>
              );
            })}
          </ul>
        </section>

        <section className="test-card__section">
          <label className="form-label" htmlFor="test-memo">
            メモ
          </label>
          <textarea
            id="test-memo"
            className="form-textarea"
            rows={3}
            placeholder="任意"
            value={memo}
            onChange={(e) => setMemo(e.target.value)}
          />
        </section>

        <footer className="test-card__footer">
          <button
            type="button"
            className="btn btn--ok"
            disabled={busy}
            onClick={() => void applyBatch("OK")}
          >
            一括 OK
          </button>
          <button
            type="button"
            className="btn btn--ng"
            disabled={busy}
            onClick={() => void applyBatch("NG")}
          >
            一括 NG
          </button>
        </footer>
      </article>
    </div>
  );
}

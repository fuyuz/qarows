import type { SessionTestTargets, TestCase, TestDefinition, TestResults, TestStatus } from "@qarows/shared";
import { RUNNER_KEYBINDINGS } from "@/lib/runner-keybindings";
import { RunnerCardFooter, type RunnerCardNavProps } from "@/components/RunnerCardFooter";

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

export interface TestCardProps extends RunnerCardNavProps {
  testCase: TestCase;
  definition: TestDefinition;
  results: TestResults;
  envTargets: SessionTestTargets;
  memo: string;
  onMemoChange: (value: string) => void;
  onBatch: (status: TestStatus) => void;
  onSingle: (envId: string, status: TestStatus) => void;
}

export function TestCard({
  testCase,
  definition,
  results,
  envTargets,
  memo,
  busy,
  canPrev,
  canNext,
  onPrev,
  onNext,
  onMemoChange,
  onBatch,
  onSingle,
}: TestCardProps) {
  return (
    <article className="test-card test-card--action">
      <div className="test-card__body">
        <header className="test-card__header">
          <span className="test-card__id">{testCase.id}</span>
          <span className="test-card__category">{formatCategory(testCase)}</span>
        </header>

        {testCase.prerequisites && (
          <section className="test-card__section">
            <h2 className="test-card__label">前提条件</h2>
            <p className="test-card__text">{testCase.prerequisites}</p>
          </section>
        )}

        <section className="test-card__section">
          <h2 className="test-card__label">確認内容</h2>
          <p className="test-card__text test-card__text--description">{testCase.description}</p>
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
              const entry = results[testCase.id]?.[envId];
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
                        onClick={() => onSingle(envId, status)}
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
          <label className="form-label" htmlFor={`test-memo-${testCase.id}`}>
            メモ
          </label>
          <textarea
            id={`test-memo-${testCase.id}`}
            className="form-textarea"
            rows={3}
            placeholder="任意"
            value={memo}
            onChange={(e) => onMemoChange(e.target.value)}
          />
        </section>
      </div>

      <RunnerCardFooter
        canPrev={canPrev}
        canNext={canNext}
        busy={busy}
        onPrev={onPrev}
        onNext={onNext}
      >
        <button type="button" className="btn btn--ok" disabled={busy} onClick={() => onBatch("OK")}>
          一括 OK <kbd className="kbd">{RUNNER_KEYBINDINGS.ok[0]}</kbd>
        </button>
        <button type="button" className="btn btn--ng" disabled={busy} onClick={() => onBatch("NG")}>
          一括 NG <kbd className="kbd">{RUNNER_KEYBINDINGS.ng[0]}</kbd>
        </button>
      </RunnerCardFooter>
    </article>
  );
}

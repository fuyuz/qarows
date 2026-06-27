import { useNavigate } from "react-router-dom";
import { FilterBar } from "@/components/FilterBar";
import { useApp } from "@/context/AppContext";
import { filterTestCases } from "@/lib/utils";

/** Step 5 で本実装予定のプレースホルダー */
export function RunPage() {
  const navigate = useNavigate();
  const { definition, results, session, runnerFilters } = useApp();

  if (!definition || !results || !session) return null;

  const targets = filterTestCases(definition, session, runnerFilters, results.results);
  const envNames = definition.environments
    .filter((e) => session.selectedEnvironmentIds.includes(e.id))
    .map((e) => e.name)
    .join("、");

  return (
    <div className="run-layout">
      <FilterBar />
      <main className="page run-content">
        <header className="page__header">
          <h1 className="page__title">テスト実行</h1>
          <p className="page__subtitle">
            {targets.length} 件のテスト — {envNames}（Step 5 で入力 UI を実装）
          </p>
        </header>

        <p className="session-summary">実施者: {session.executorName}</p>

        <footer className="page__footer">
          <button type="button" className="btn btn--ghost" onClick={() => navigate("/session")}>
            ← セッション設定に戻る
          </button>
        </footer>
      </main>
    </div>
  );
}

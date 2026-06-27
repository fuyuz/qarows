import { useNavigate } from "react-router-dom";
import { FilterBar } from "@/components/FilterBar";
import { TestRunner } from "@/components/TestRunner";
import { useApp } from "@/context/AppContext";

export function RunPage() {
  const navigate = useNavigate();
  const { definition, session } = useApp();

  if (!definition || !session) return null;

  return (
    <div className="run-layout">
      <FilterBar />
      <main className="page run-content">
        <header className="page__header">
          <h1 className="page__title">テスト実行</h1>
          <p className="page__subtitle">実施者: {session.executorName}</p>
        </header>

        <TestRunner />

        <footer className="page__footer">
          <button type="button" className="btn btn--ghost" onClick={() => navigate("/session")}>
            ← セッション設定に戻る
          </button>
        </footer>
      </main>
    </div>
  );
}

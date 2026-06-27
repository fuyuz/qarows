import { useNavigate } from "react-router-dom";
import { FilterBar } from "@/components/FilterBar";
import { ShortcutHelp } from "@/components/ShortcutHelp";
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
        <TestRunner />

        <footer className="page__footer">
          <button type="button" className="btn btn--ghost" onClick={() => navigate("/session")}>
            ← セッション設定に戻る
          </button>
        </footer>
      </main>
      <ShortcutHelp />
    </div>
  );
}

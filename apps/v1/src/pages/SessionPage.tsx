import { useNavigate } from "react-router-dom";
import { useApp } from "@/context/AppContext";

/** Step 3 で本実装予定のプレースホルダー */
export function SessionPage() {
  const navigate = useNavigate();
  const { definition } = useApp();

  return (
    <main className="page">
      <header className="page__header">
        <h1 className="page__title">セッション設定</h1>
        <p className="page__subtitle">
          {definition
            ? `プロジェクト: ${definition.project.name} — 端末/環境の選択（Step 3 で実装）`
            : "プロジェクトが読み込まれていません"}
        </p>
      </header>
      <button type="button" className="btn btn--ghost" onClick={() => navigate("/load")}>
        ← ファイル読み込みに戻る
      </button>
    </main>
  );
}

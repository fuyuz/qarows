import { formatRunnerKeys, RUNNER_KEYBINDINGS } from "@/lib/runner-keybindings";

export function RunnerIntroCard() {
  return (
    <article className="test-card test-card--intro">
      <header className="test-card__header">
        <span className="test-card__id test-card__id--intro">START</span>
        <span className="test-card__category">使い方</span>
      </header>

      <section className="test-card__section">
        <h2 className="test-card__label">テストの進め方</h2>
        <p className="test-card__text test-card__text--description">
          1件ずつ確認内容を読み、対象端末ごとに結果を入力します。右の矢印か{" "}
          <kbd className="kbd">{formatRunnerKeys(RUNNER_KEYBINDINGS.next)}</kbd>{" "}
          で次へ進んでください。
        </p>
      </section>

      <section className="test-card__section">
        <h2 className="test-card__label">結果の入力</h2>
        <ul className="runner-guide-list">
          <li>
            <kbd className="kbd">{formatRunnerKeys(RUNNER_KEYBINDINGS.ok)}</kbd>
            <span>一括 OK</span>
          </li>
          <li>
            <kbd className="kbd">{formatRunnerKeys(RUNNER_KEYBINDINGS.ng)}</kbd>
            <span>一括 NG</span>
          </li>
          <li>
            <kbd className="kbd">{formatRunnerKeys(RUNNER_KEYBINDINGS.skip)}</kbd>
            <span>一括 SKIP</span>
          </li>
        </ul>
        <p className="test-card__text">ボタンから端末ごとに入力することもできます。</p>
      </section>

      <section className="test-card__section">
        <h2 className="test-card__label">その他</h2>
        <p className="test-card__text">
          画面右下の <strong>?</strong>{" "}
          にショートカット一覧があります。メモ入力中はキーボード操作は無効です。
        </p>
      </section>
    </article>
  );
}

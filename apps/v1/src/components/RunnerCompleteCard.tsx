export function RunnerCompleteCard({ testCount }: { testCount: number }) {
  return (
    <article className="test-card test-card--complete">
      <div className="test-card__celebrate" aria-hidden="true">
        🎉
      </div>
      <header className="test-card__header test-card__header--center">
        <span className="test-card__id test-card__id--complete">DONE</span>
      </header>

      <section className="test-card__section">
        <h2 className="test-card__label test-card__label--center">お疲れさまでした！</h2>
        <p className="test-card__text test-card__text--description test-card__text--center">
          {testCount > 0
            ? `表示中の ${testCount} 件のテストをすべて入力しました。`
            : "対象のテストはありませんでした。"}
        </p>
      </section>

      <section className="test-card__section">
        <p className="test-card__text test-card__text--center">
          結果は自動保存されています。フィルタを変えて続けるか、セッション設定からエクスポートできます。
        </p>
      </section>
    </article>
  );
}

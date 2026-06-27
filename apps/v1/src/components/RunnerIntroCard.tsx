import { formatRunnerKeys, RUNNER_KEYBINDINGS } from "@/lib/runner-keybindings";
import { Kbd } from "@/components/qa-ui";
import { RunnerCardFooter, testCardShellClass, type RunnerCardNavProps } from "@/components/RunnerCardFooter";
import { Badge } from "@/components/ui/badge";

export function RunnerIntroCard(props: RunnerCardNavProps) {
  return (
    <article className={testCardShellClass()}>
      <div className="min-h-0 flex-1 overflow-y-auto pb-3">
        <header className="mb-5 flex flex-wrap items-baseline gap-x-3 gap-y-1 border-b pb-3.5">
          <Badge variant="secondary" className="font-bold">
            START
          </Badge>
          <span className="text-sm text-muted-foreground">使い方</span>
        </header>

        <section className="mb-5">
          <h2 className="mb-1.5 text-xs font-semibold tracking-wide text-muted-foreground uppercase">
            テストの進め方
          </h2>
          <p className="text-base leading-relaxed font-medium">
            1件ずつ確認内容を読み、対象端末ごとに結果を入力します。「はじめる」か{" "}
            <Kbd>{formatRunnerKeys(RUNNER_KEYBINDINGS.next)}</Kbd> で次へ進んでください。
          </p>
          <p className="mt-2 text-sm text-muted-foreground">
            <Kbd>{formatRunnerKeys(RUNNER_KEYBINDINGS.ok)}</Kbd> などの一括入力は、表示中の全端末に同じ結果を記録します。
          </p>
        </section>

        <section className="mb-5">
          <h2 className="mb-1.5 text-xs font-semibold tracking-wide text-muted-foreground uppercase">
            結果の入力
          </h2>
          <ul className="mb-3 flex flex-col gap-2">
            <li className="flex items-center gap-2.5 text-sm">
              <Kbd>{formatRunnerKeys(RUNNER_KEYBINDINGS.ok)}</Kbd>
              <span>一括 OK</span>
            </li>
            <li className="flex items-center gap-2.5 text-sm">
              <Kbd>{formatRunnerKeys(RUNNER_KEYBINDINGS.ng)}</Kbd>
              <span>一括 NG</span>
            </li>
            <li className="flex items-center gap-2.5 text-sm">
              <Kbd>{formatRunnerKeys(RUNNER_KEYBINDINGS.skip)}</Kbd>
              <span>一括 SKIP</span>
            </li>
          </ul>
          <p className="text-sm text-muted-foreground">ボタンから端末ごとに入力することもできます。</p>
        </section>

        <section className="mb-5">
          <h2 className="mb-1.5 text-xs font-semibold tracking-wide text-muted-foreground uppercase">
            その他
          </h2>
          <p className="text-sm text-muted-foreground">
            画面右下の <strong className="text-foreground">?</strong>{" "}
            にショートカット一覧があります。メモ入力中はキーボード操作は無効です。
          </p>
        </section>
      </div>

      <RunnerCardFooter {...props} mode="intro" />
    </article>
  );
}

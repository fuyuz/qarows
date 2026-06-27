import { RunnerCardFooter, testCardShellClass, type RunnerCardNavProps } from "@/components/RunnerCardFooter";
import { Badge } from "@/components/ui/badge";

export function RunnerCompleteCard({
  testCount,
  ...navProps
}: { testCount: number } & RunnerCardNavProps) {
  return (
    <article className={testCardShellClass("border-green-200 bg-gradient-to-b from-card to-green-50/80")}>
      <div className="min-h-0 flex-1 overflow-y-auto pb-3 text-center">
        <div className="mb-2 text-4xl leading-none" aria-hidden="true">
          🎉
        </div>
        <header className="mb-5 flex justify-center pb-3.5">
          <Badge className="border-transparent bg-green-100 font-bold text-green-800 hover:bg-green-100">
            DONE
          </Badge>
        </header>

        <section className="mb-5">
          <h2 className="mb-1.5 text-base font-semibold text-green-800">お疲れさまでした！</h2>
          <p className="text-base leading-relaxed font-medium">
            {testCount > 0
              ? `表示中の ${testCount} 件のテストをすべて入力しました。`
              : "対象のテストはありませんでした。"}
          </p>
        </section>

        <section className="mb-5">
          <p className="text-sm text-muted-foreground">
            結果は自動保存されています。フィルタを変えて続けるか、セッション設定からエクスポートできます。
          </p>
        </section>
      </div>

      <RunnerCardFooter {...navProps} mode="complete" />
    </article>
  );
}

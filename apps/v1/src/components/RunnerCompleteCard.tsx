import { CheckCircle2 } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { RunnerCardFooter, testCardShellClass, type RunnerCardNavProps } from "@/components/RunnerCardFooter";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

export function RunnerCompleteCard({
  testCount,
  ...navProps
}: { testCount: number } & RunnerCardNavProps) {
  const navigate = useNavigate();

  return (
    <article className={testCardShellClass("border-green-200/80 bg-green-50/30")}>
      <div className="min-h-0 flex-1 overflow-y-auto pb-3 text-center">
        <div
          className="mx-auto mb-4 flex size-14 items-center justify-center rounded-full bg-green-100 animate-in zoom-in-95 fade-in fill-mode-both duration-300"
          aria-hidden
        >
          <CheckCircle2 className="size-8 text-green-700" strokeWidth={2} />
        </div>
        <header className="mb-5 flex justify-center pb-3.5 animate-in fade-in duration-250 fill-mode-both delay-75">
          <Badge className="border-transparent bg-green-100 font-bold text-green-800 hover:bg-green-100">
            完了
          </Badge>
        </header>

        <section className="mb-5 animate-in fade-in duration-250 fill-mode-both delay-100">
          <h2 className="mb-1.5 text-base font-semibold text-green-900">このスコープの入力が完了しました</h2>
          <p className="text-base leading-relaxed font-medium text-foreground">
            {testCount > 0
              ? `表示中の ${testCount} 件すべてに結果を記録しました。`
              : "対象のテストはありませんでした。"}
          </p>
        </section>

        <section className="mb-5 animate-in fade-in duration-250 fill-mode-both delay-150">
          <p className="text-sm text-muted-foreground">
            結果は自動保存されています。上部のフィルタを変えて続けるか、セッション設定からエクスポートできます。
          </p>
        </section>

        <section className="flex flex-wrap justify-center gap-2 animate-in fade-in duration-250 fill-mode-both delay-200">
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="font-semibold"
            onClick={() => navigate("/session")}
          >
            セッション設定へ
          </Button>
        </section>
      </div>

      <RunnerCardFooter {...navProps} mode="complete" />
    </article>
  );
}

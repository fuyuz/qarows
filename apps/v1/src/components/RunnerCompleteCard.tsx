import { useNavigate } from "react-router-dom";
import { RunnerCardFooter, testCardShellClass, type RunnerCardNavProps } from "@/components/RunnerCardFooter";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useProjectRoutes } from "@/hooks/useProjectRoutes";

export function RunnerCompleteCard({
  testCount,
  ...navProps
}: { testCount: number } & RunnerCardNavProps) {
  const navigate = useNavigate();
  const { path } = useProjectRoutes();

  return (
    <article className={testCardShellClass("border-green-200/80 bg-green-50/30")}>
      <div className="min-h-0 flex-1 overflow-y-auto pb-3">
        <header className="mb-5 flex flex-wrap items-baseline gap-x-3 gap-y-1 border-b pb-3.5">
          <Badge className="border-transparent bg-green-100 font-bold text-green-800 hover:bg-green-100">
            完了
          </Badge>
          <span className="text-sm text-muted-foreground">スコープ完了</span>
        </header>

        <section className="mb-5">
          <h2 className="mb-1.5 text-xs font-semibold tracking-wide text-muted-foreground uppercase">
            入力完了
          </h2>
          <p className="text-base leading-relaxed font-medium">
            {testCount > 0
              ? `表示中の ${testCount} 件すべてに結果を記録しました。`
              : "対象のテストはありませんでした。"}
          </p>
        </section>

        <section className="mb-5">
          <h2 className="mb-1.5 text-xs font-semibold tracking-wide text-muted-foreground uppercase">
            次の操作
          </h2>
          <p className="text-sm text-muted-foreground">
            結果は自動保存されています。上部のフィルタを変えて続けるか、セッション設定からエクスポートできます。
          </p>
        </section>

        <section className="flex flex-wrap gap-2">
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="font-semibold"
            onClick={() => navigate(path("session"))}
          >
            セッション設定へ
          </Button>
        </section>
      </div>

      <RunnerCardFooter {...navProps} mode="complete" />
    </article>
  );
}

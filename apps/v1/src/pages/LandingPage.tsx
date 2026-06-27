import { ArrowRight, ExternalLink, Shield } from "lucide-react";
import { Link, useNavigate } from "react-router-dom";
import { isValidSession } from "@qarows/shared";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { useApp } from "@/context/AppContext";
import { GITHUB_REPO_URL } from "@/lib/site-links";
import { projectPath } from "@/lib/project-routes";

const FEATURES = [
  "tests.yml からテストケースと端末/環境を読み込み",
  "1件ずつ集中入力するテストランナー（OK / NG / SKIP、キーボード操作）",
  "端末/環境の選択、大・中・小分類フィルタ、シナリオモード",
  "バグの起票・編集、ダッシュボード・マトリクスでの進捗確認",
  "results.json / tests.yml のエクスポート、results.json のマージ",
  "作業内容の IndexedDB 自動保存（ページを閉じても復元）",
] as const;

function resolveContinuePath(
  definition: ReturnType<typeof useApp>["definition"],
  session: ReturnType<typeof useApp>["session"],
): string | null {
  if (!definition) return null;
  const projectId = definition.project.id ?? "project";
  if (session && isValidSession(session)) {
    return projectPath(projectId, "run");
  }
  return projectPath(projectId, "session");
}

export function LandingPage() {
  const navigate = useNavigate();
  const { definition, session } = useApp();
  const continuePath = resolveContinuePath(definition, session);

  return (
    <div className="min-h-svh bg-background">
      <header className="border-b bg-card/80 backdrop-blur-sm">
        <div className="mx-auto flex max-w-3xl items-center justify-between gap-4 px-5 py-4">
          <div>
            <p className="text-lg font-bold tracking-tight">qarows</p>
            <p className="text-xs text-muted-foreground">QA シート特化ツール</p>
          </div>
          <Button variant="outline" size="sm" asChild>
            <a href={GITHUB_REPO_URL} target="_blank" rel="noopener noreferrer">
              <ExternalLink className="size-4" aria-hidden />
              GitHub
            </a>
          </Button>
        </div>
      </header>

      <main className="mx-auto max-w-3xl px-5 py-10">
        <section className="mb-8">
          <h1 className="mb-3 text-2xl font-bold tracking-tight sm:text-3xl">
            テストケース × 端末/環境を、
            <br className="hidden sm:block" />
            1件ずつ進める QA シート
          </h1>
          <p className="text-sm leading-relaxed text-muted-foreground sm:text-base">
            スプレッドシートのマトリクス運用の課題——スクロール、入力の煩雑さ、絞り込み——を、
            ブラウザ上の専用 UI で解消します。
          </p>
          <div className="mt-6 flex flex-wrap gap-3">
            <Button size="lg" onClick={() => navigate("/load")}>
              はじめる
              <ArrowRight className="size-4" aria-hidden />
            </Button>
            {continuePath && (
              <Button size="lg" variant="secondary" asChild>
                <Link to={continuePath}>作業を続ける</Link>
              </Button>
            )}
          </div>
        </section>

        <Card className="mb-6">
          <CardHeader>
            <CardTitle className="text-base">できること</CardTitle>
            <CardDescription>Phase 1（ブラウザ完結・ファイル連携）</CardDescription>
          </CardHeader>
          <CardContent>
            <ul className="flex flex-col gap-2.5 text-sm leading-relaxed">
              {FEATURES.map((item) => (
                <li key={item} className="flex gap-2">
                  <span className="mt-1.5 size-1.5 shrink-0 rounded-full bg-primary" aria-hidden />
                  <span>{item}</span>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>

        <Alert className="mb-6 border-primary/20 bg-primary/5">
          <Shield className="size-4" aria-hidden />
          <AlertTitle>データはローカルのみ</AlertTitle>
          <AlertDescription className="leading-relaxed">
            テスト定義・実行結果・バグ情報は、お使いのブラウザ内（IndexedDB）と、
            ご自身で export したファイルにのみ保存されます。
            サーバーへ送信したり、qarows 側で保持したりすることはありません。
          </AlertDescription>
        </Alert>

        <p className="text-center text-xs text-muted-foreground">
          ソースコードは{" "}
          <a
            href={GITHUB_REPO_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="font-medium text-primary underline-offset-4 hover:underline"
          >
            GitHub（fuyuz/qarows）
          </a>
          {" "}で公開しています（MIT License）。
        </p>
      </main>
    </div>
  );
}

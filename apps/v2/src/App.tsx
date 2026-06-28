import { useEffect, useState } from "react";
import { Button, Card, CardContent, CardDescription, CardHeader, CardTitle } from "@qarows/ui";

interface HealthResponse {
  ok: boolean;
  service: string;
  phase: number;
}

export function App() {
  const [health, setHealth] = useState<HealthResponse | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    void fetch("/api/health")
      .then(async (response) => {
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        return response.json() as Promise<HealthResponse>;
      })
      .then(setHealth)
      .catch((err: unknown) => {
        setError(err instanceof Error ? err.message : "API に接続できません");
      });
  }, []);

  return (
    <main className="mx-auto flex min-h-svh w-full max-w-lg items-center px-5 py-10">
      <Card className="w-full">
        <CardHeader>
          <CardTitle>qarows Phase 2</CardTitle>
          <CardDescription>
            協調版（Workers + リアルタイム同期）の開発用スキャフォールドです。Phase 1（
            <code className="text-xs">apps/v1</code>
            ）とは独立してビルド・デプロイします。
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="rounded-lg border bg-muted/30 px-3 py-2 text-sm">
            <p className="font-medium">共有 UI</p>
            <p className="mt-1 text-muted-foreground">
              この画面は <code className="text-xs">@qarows/ui</code> の Button / Card を使用しています。
            </p>
          </div>

          <div className="rounded-lg border px-3 py-2 text-sm">
            <p className="font-medium">Worker /api/health</p>
            {health ? (
              <p className="mt-1 text-muted-foreground">
                {health.service} — phase {health.phase}
              </p>
            ) : error ? (
              <p className="mt-1 text-destructive">{error}</p>
            ) : (
              <p className="mt-1 text-muted-foreground">確認中…</p>
            )}
          </div>

          <Button variant="outline" onClick={() => window.location.reload()}>
            再読み込み
          </Button>
        </CardContent>
      </Card>
    </main>
  );
}

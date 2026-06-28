import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { Button, Card, CardContent, CardDescription, CardHeader, CardTitle } from "@qarows/ui";
import { getProject } from "@/lib/api/projects";
import { projectsHubPath } from "@/lib/project-routes";

export function ProjectWorkspacePage() {
  const { projectId } = useParams<{ projectId: string }>();
  const [name, setName] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!projectId) return;
    let cancelled = false;
    void getProject(projectId)
      .then((snapshot) => {
        if (!cancelled) setName(snapshot.name);
      })
      .catch((err: unknown) => {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : "プロジェクトの取得に失敗しました");
        }
      });
    return () => {
      cancelled = true;
    };
  }, [projectId]);

  return (
    <main className="mx-auto flex min-h-svh w-full max-w-lg items-center px-5 py-10">
      <Card className="w-full">
        <CardHeader>
          <CardTitle>{name ?? projectId ?? "プロジェクト"}</CardTitle>
          <CardDescription>
            リアルタイム同期ワークスペースは次のステップで実装します（WebSocket + Phase 1 相当 UI）。
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {error && <p className="text-sm text-destructive">{error}</p>}
          <Button asChild variant="outline">
            <Link to={projectsHubPath(projectId ?? null)}>プロジェクト一覧へ戻る</Link>
          </Button>
        </CardContent>
      </Card>
    </main>
  );
}

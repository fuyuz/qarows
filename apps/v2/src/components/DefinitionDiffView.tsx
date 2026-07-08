import type { DefinitionDiff } from "@qarows/shared";
import { definitionDiffSummary } from "@qarows/shared";
import { Badge, cn } from "@qarows/ui";

export function DefinitionDiffView({ diff }: { diff: DefinitionDiff }) {
  if (!diff.hasChanges) {
    return <p className="text-sm text-muted-foreground">変更はありません。</p>;
  }

  return (
    <div className="space-y-4">
      <p className="text-sm font-medium">{definitionDiffSummary(diff)}</p>

      {diff.project.length > 0 && (
        <section className="space-y-2">
          <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            プロジェクト
          </h3>
          {diff.project.map((change) => (
            <FieldChangeRow key={change.field} change={change} />
          ))}
        </section>
      )}

      {(diff.environments.added.length > 0 ||
        diff.environments.removed.length > 0 ||
        diff.environments.modified.length > 0) && (
        <section className="space-y-2">
          <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            端末 / 環境
          </h3>
          {diff.environments.added.map((env) => (
            <div key={env.id} className="rounded-md border border-green-200 bg-green-50/80 px-3 py-2 text-sm">
              <Badge variant="secondary" className="mr-2 bg-green-100 text-green-900">
                追加
              </Badge>
              {env.id} — {env.name}
            </div>
          ))}
          {diff.environments.removed.map((id) => (
            <div
              key={id}
              className="rounded-md border border-red-200 bg-red-50/80 px-3 py-2 text-sm line-through"
            >
              <Badge variant="secondary" className="mr-2 bg-red-100 text-red-900">
                削除
              </Badge>
              {id}
            </div>
          ))}
          {diff.environments.modified.map((env) => (
            <div
              key={env.id}
              className="rounded-md border border-amber-200 bg-amber-50/60 px-3 py-2 text-sm"
            >
              <Badge variant="secondary" className="mr-2 bg-amber-100 text-amber-950">
                変更
              </Badge>
              {env.id}
              {env.fields.map((field) => (
                <FieldChangeRow key={field.field} change={field} compact />
              ))}
            </div>
          ))}
        </section>
      )}

      {(diff.testCases.added.length > 0 ||
        diff.testCases.removed.length > 0 ||
        diff.testCases.modified.length > 0) && (
        <section className="space-y-2">
          <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            テストケース
          </h3>
          {diff.testCases.added.map((tc) => (
            <div
              key={tc.id}
              className="rounded-md border border-green-200 bg-green-50/80 px-3 py-2 text-sm"
            >
              <Badge variant="secondary" className="mr-2 bg-green-100 text-green-900">
                追加
              </Badge>
              <span className="font-medium">{tc.id}</span>
              <p className="mt-1 text-muted-foreground">{tc.description}</p>
            </div>
          ))}
          {diff.testCases.removed.map((id) => (
            <div
              key={id}
              className="rounded-md border border-red-200 bg-red-50/80 px-3 py-2 text-sm line-through"
            >
              <Badge variant="secondary" className="mr-2 bg-red-100 text-red-900">
                削除
              </Badge>
              {id}
            </div>
          ))}
          {diff.testCases.modified.map((tc) => (
            <div
              key={tc.id}
              className="rounded-md border border-amber-200 bg-amber-50/60 px-3 py-2 text-sm"
            >
              <Badge variant="secondary" className="mr-2 bg-amber-100 text-amber-950">
                変更
              </Badge>
              <span className="font-medium">{tc.id}</span>
              {tc.fields.map((field) => (
                <FieldChangeRow key={field.field} change={field} compact />
              ))}
            </div>
          ))}
        </section>
      )}

      {(diff.categoryTargets || diff.scenarios) && (
        <section className="space-y-1 text-sm text-muted-foreground">
          {diff.categoryTargets ? <p>categoryTargets に変更があります</p> : null}
          {diff.scenarios ? <p>scenarios に変更があります</p> : null}
        </section>
      )}
    </div>
  );
}

function FieldChangeRow({
  change,
  compact = false,
}: {
  change: { field: string; before: string; after: string };
  compact?: boolean;
}) {
  return (
    <div className={cn("mt-2 space-y-1", compact && "ml-0")}>
      <p className="text-xs font-medium text-muted-foreground">{change.field}</p>
      {change.before ? (
        <p className="rounded bg-red-50/80 px-2 py-1 text-xs text-red-950 line-through">{change.before}</p>
      ) : null}
      {change.after ? (
        <p className="rounded bg-green-50/80 px-2 py-1 text-xs text-green-950">{change.after}</p>
      ) : null}
    </div>
  );
}

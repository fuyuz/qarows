import { useState } from "react";
import { serializeTestsYaml, type TestDefinition } from "@qarows/shared";
import {
  Alert,
  AlertDescription,
  Button,
} from "@qarows/ui";
import { DefinitionDiffView } from "@/components/DefinitionDiffView";
import { YamlTextDiffView } from "@/components/YamlTextDiffView";
import type { AiProposal, DefinitionRevisionSummary } from "@/lib/api/ai";

export function TestsYamlAiProposalPanel({
  proposal,
  baseDefinition,
  busy,
  successMessage,
  errorMessage,
  revisions,
  onApply,
  onDiscard,
  onRestore,
}: {
  proposal: AiProposal | null;
  baseDefinition: TestDefinition;
  busy: boolean;
  successMessage: string | null;
  errorMessage: string | null;
  revisions: DefinitionRevisionSummary[];
  onApply: () => void;
  onDiscard: () => void;
  onRestore: (revisionId: string) => void;
}) {
  const [yamlDiffOpen, setYamlDiffOpen] = useState(false);
  const baseYaml = serializeTestsYaml(baseDefinition);

  return (
    <div className="flex min-h-0 flex-1 flex-col rounded-lg border bg-card">
      <div className="border-b px-4 py-3">
        <h2 className="text-sm font-semibold">編集案</h2>
        {proposal?.modelUsed ? (
          <p className="mt-1 text-xs text-muted-foreground">モデル: {proposal.modelUsed}</p>
        ) : null}
      </div>

      <div className="min-h-0 flex-1 space-y-4 overflow-y-auto px-4 py-4">
        {successMessage ? (
          <Alert>
            <AlertDescription>{successMessage}</AlertDescription>
          </Alert>
        ) : null}
        {errorMessage ? (
          <Alert variant="destructive">
            <AlertDescription>{errorMessage}</AlertDescription>
          </Alert>
        ) : null}

        {proposal ? (
          <>
            <DefinitionDiffView diff={proposal.diff} />
            <div>
              <button
                type="button"
                className="text-sm font-medium text-primary underline-offset-4 hover:underline"
                onClick={() => setYamlDiffOpen((open) => !open)}
              >
                {yamlDiffOpen ? "YAML 全文 diff を隠す" : "YAML 全文 diff を表示"}
              </button>
              {yamlDiffOpen ? (
                <div className="mt-2">
                  <YamlTextDiffView before={baseYaml} after={proposal.proposedYaml} />
                </div>
              ) : null}
            </div>
          </>
        ) : (
          <p className="text-sm text-muted-foreground">
            質問だけでも OK です。編集指示を送ると、ここに tests.yml の変更案が表示されます。
          </p>
        )}

        {revisions.length > 0 ? (
          <section className="space-y-2 border-t pt-4">
            <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              履歴（元に戻す）
            </h3>
            <ul className="space-y-2">
              {revisions.map((revision) => (
                <li
                  key={revision.id}
                  className="flex flex-wrap items-center justify-between gap-2 rounded-md border px-3 py-2 text-sm"
                >
                  <div className="min-w-0">
                    <p className="font-medium">{revision.source}</p>
                    <p className="text-xs text-muted-foreground">
                      {new Date(revision.createdAt).toLocaleString("ja-JP")}
                      {revision.createdBy ? ` · ${revision.createdBy}` : ""}
                    </p>
                    {revision.instruction ? (
                      <p className="mt-1 truncate text-xs text-muted-foreground">{revision.instruction}</p>
                    ) : null}
                  </div>
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    disabled={busy}
                    onClick={() => onRestore(revision.id)}
                  >
                    復元
                  </Button>
                </li>
              ))}
            </ul>
          </section>
        ) : null}
      </div>

      {proposal ? (
        <div className="flex justify-end gap-2 border-t px-4 py-3">
          <Button type="button" variant="outline" disabled={busy} onClick={onDiscard}>
            破棄
          </Button>
          <Button type="button" disabled={busy || !proposal.diff.hasChanges} onClick={onApply}>
            適用
          </Button>
        </div>
      ) : null}
    </div>
  );
}

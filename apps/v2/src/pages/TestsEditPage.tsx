import { useCallback, useState } from "react";
import { serializeTestsYaml, type TestDefinition } from "@qarows/shared";
import {
  TestsEditPageLayout,
  type TestsEditDraftImport,
  type TestsEditDraftState,
} from "@qarows/runner-ui";
import { Button } from "@qarows/ui";
import { Sparkles } from "lucide-react";
import { AppNav } from "@/components/AppNav";
import { TestsYamlAiChatPanel } from "@/components/TestsYamlAiChatPanel";
import { TestsYamlAiProposalPanel } from "@/components/TestsYamlAiProposalPanel";
import { useAiFeatures } from "@/context/AiFeaturesContext";
import { useProjectSync } from "@/context/ProjectSyncContext";
import { useTestsYamlAiEdit } from "@/hooks/useTestsYamlAiEdit";
import { ApiError } from "@/lib/api/client";
import { applyDefinitionEdit, getProject } from "@/lib/api/projects";
import { useParams } from "react-router-dom";

export function TestsEditPage() {
  const { projectId } = useParams<{ projectId: string }>();
  const { definition, revision, syncNotice } = useProjectSync();
  const { aiEnabled, loaded: aiLoaded } = useAiFeatures();
  const [draftState, setDraftState] = useState<TestsEditDraftState>({
    hasChanges: false,
    draft: null,
  });
  const [draftImport, setDraftImport] = useState<TestsEditDraftImport | null>(null);
  const [aiOpen, setAiOpen] = useState(true);
  const [importToken, setImportToken] = useState(0);

  // AI 無効 / 未判定中はフックを動かさない（sessionStorage・revisions API を叩かない）
  const aiActive = aiLoaded && aiEnabled;

  const ai = useTestsYamlAiEdit({
    enabled: aiActive,
    projectId,
    definition,
    draft: draftState.draft,
  });

  const onApply = useCallback(
    async (next: TestDefinition) => {
      if (!projectId) throw new Error("projectId がありません");
      const snapshot = await getProject(projectId);
      const generation = snapshot.generation;
      if (!generation) throw new Error("generation を取得できませんでした");
      try {
        await applyDefinitionEdit(projectId, {
          testsYaml: serializeTestsYaml(next),
          expectedGeneration: generation,
        });
      } catch (err) {
        throw new Error(err instanceof ApiError ? err.message : "定義の適用に失敗しました");
      }
    },
    [projectId],
  );

  const handleLoadProposalIntoDraft = useCallback(() => {
    if (draftState.hasChanges) {
      const ok = window.confirm(
        "編集画面に未適用の変更があります。AI の編集案で上書きしますか？",
      );
      if (!ok) return;
    }
    const accepted = ai.acceptProposalIntoDraft();
    if (!accepted) return;
    const token = importToken + 1;
    setImportToken(token);
    setDraftImport({ definition: accepted, token });
    // Optimistic: next AI turn can use post-diff YAML before draftImport useEffect lands.
    setDraftState({ hasChanges: true, draft: accepted });
  }, [ai, draftState.hasChanges, importToken]);

  if (!definition || !projectId) return null;

  const aiAside =
    aiActive && aiOpen ? (
      <aside className="flex w-full max-w-md shrink-0 flex-col gap-3 border-l border-border/80 bg-background p-3 lg:w-[22rem] xl:w-[26rem]">
        <div className="flex items-center justify-between gap-2">
          <div className="min-w-0">
            <h2 className="text-sm font-semibold">AI アシスタント</h2>
            <p className="truncate text-xs text-muted-foreground">
              質問・編集指示 → 編集画面に反映 → Apply
            </p>
          </div>
          <Button type="button" size="sm" variant="ghost" onClick={() => setAiOpen(false)}>
            閉じる
          </Button>
        </div>
        {syncNotice ? <p className="text-xs text-amber-800">{syncNotice}</p> : null}
        <div className="grid min-h-0 flex-1 gap-3 overflow-hidden lg:grid-rows-2">
          <TestsYamlAiChatPanel
            messages={ai.chatMessages}
            input={ai.input}
            busy={ai.busy}
            onInputChange={ai.setInput}
            onSend={() => void ai.handleSend()}
            onReset={ai.handleReset}
          />
          <TestsYamlAiProposalPanel
            proposal={ai.proposal}
            editIntentWithoutProposal={ai.editIntentWithoutProposal}
            baseDefinition={draftState.draft ?? definition}
            busy={ai.busy}
            successMessage={ai.successMessage}
            errorMessage={ai.errorMessage}
            revisions={ai.revisions}
            applyLabel="編集画面に反映"
            onApply={handleLoadProposalIntoDraft}
            onDiscard={ai.handleDiscardProposal}
            onRestore={(revisionId) => void ai.handleRestore(revisionId)}
          />
        </div>
      </aside>
    ) : null;

  return (
    <TestsEditPageLayout
      definition={definition}
      onApply={onApply}
      syncKey={revision}
      draftImport={draftImport}
      onDraftImportConsumed={() => setDraftImport(null)}
      onDraftStateChange={setDraftState}
      navSlot={<AppNav />}
      asideSlot={
        aiActive ? (
          <>
            {aiAside}
            {!aiOpen ? (
              <div className="fixed right-5 bottom-20 z-40">
                <Button type="button" size="sm" className="shadow-sm" onClick={() => setAiOpen(true)}>
                  <Sparkles className="mr-1.5 size-3.5" />
                  AI
                </Button>
              </div>
            ) : null}
          </>
        ) : undefined
      }
    />
  );
}

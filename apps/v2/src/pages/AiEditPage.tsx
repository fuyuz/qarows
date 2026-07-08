import { useCallback, useEffect, useMemo, useState } from "react";
import { Navigate, useParams } from "react-router-dom";
import { ApiError } from "@/lib/api/client";
import { getProject } from "@/lib/api/projects";
import {
  applyAiProposal,
  listDefinitionRevisions,
  proposeAiEdit,
  restoreDefinitionRevision,
  type AiChatMessage,
  type AiIntent,
  type AiProposal,
  type DefinitionRevisionSummary,
} from "@/lib/api/ai";
import { clearAiSession, loadAiSession, saveAiSession } from "@/lib/ai-session-storage";
import { AppNav } from "@/components/AppNav";
import { TestsYamlAiChatPanel } from "@/components/TestsYamlAiChatPanel";
import { TestsYamlAiProposalPanel } from "@/components/TestsYamlAiProposalPanel";
import { useAiFeatures } from "@/context/AiFeaturesContext";
import { useProjectSync } from "@/context/ProjectSyncContext";

export function AiEditPageRoute() {
  const { aiEnabled, loaded } = useAiFeatures();
  const { ready, definition } = useProjectSync();

  if (!loaded || !ready) return null;
  if (!aiEnabled) return <Navigate to="../session" replace />;
  if (!definition) return <Navigate to="/projects" replace />;

  return <AiEditPage />;
}

function AiEditPage() {
  const { projectId } = useParams<{ projectId: string }>();
  const { definition, syncNotice } = useProjectSync();
  const [chatMessages, setChatMessages] = useState<AiChatMessage[]>([]);
  const [proposal, setProposal] = useState<AiProposal | null>(null);
  const [workingFrom, setWorkingFrom] = useState<"definition" | "proposal">("definition");
  const [baseGeneration, setBaseGeneration] = useState("");
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [lastIntent, setLastIntent] = useState<AiIntent | null>(null);
  const [revisions, setRevisions] = useState<DefinitionRevisionSummary[]>([]);

  const loadRevisions = useCallback(async () => {
    if (!projectId) return;
    try {
      const data = await listDefinitionRevisions(projectId);
      setRevisions(data.revisions);
    } catch {
      // non-fatal
    }
  }, [projectId]);

  const refreshGeneration = useCallback(async () => {
    if (!projectId) return null;
    const snapshot = await getProject(projectId);
    setBaseGeneration(snapshot.generation ?? "");
    return snapshot.generation ?? "";
  }, [projectId]);

  useEffect(() => {
    if (!projectId) return;
    const saved = loadAiSession(projectId);
    if (saved) {
      setChatMessages(saved.chatMessages);
      setProposal(saved.proposal);
      setWorkingFrom(saved.workingFrom);
      setBaseGeneration(saved.baseGeneration);
    }
    void refreshGeneration();
    void loadRevisions();
  }, [projectId, refreshGeneration, loadRevisions]);

  useEffect(() => {
    if (!projectId) return;
    saveAiSession(projectId, {
      chatMessages,
      proposal,
      workingFrom,
      baseGeneration,
    });
  }, [projectId, chatMessages, proposal, workingFrom, baseGeneration]);

  const lastUserInstruction = useMemo(() => {
    for (let i = chatMessages.length - 1; i >= 0; i -= 1) {
      const message = chatMessages[i];
      if (message?.role === "user") return message.content;
    }
    return undefined;
  }, [chatMessages]);

  const handleSend = async () => {
    if (!projectId || !definition || !input.trim() || busy) return;
    const message = input.trim();
    setInput("");
    setErrorMessage(null);
    setSuccessMessage(null);
    setLastIntent(null);

    const nextHistory: AiChatMessage[] = [...chatMessages, { role: "user", content: message }];
    setChatMessages(nextHistory);
    setBusy(true);

    try {
      const response = await proposeAiEdit(projectId, {
        message,
        history: chatMessages,
        workingFrom: proposal ? workingFrom : "definition",
        proposalYaml: proposal?.proposedYaml,
      });

      setChatMessages((prev) => [...prev, { role: "assistant", content: response.reply }]);
      setLastIntent(response.intent);
      if (response.proposal) {
        setProposal(response.proposal);
        setWorkingFrom("proposal");
      }
    } catch (err) {
      const text = err instanceof ApiError ? err.message : "AI リクエストに失敗しました";
      setErrorMessage(text);
      setChatMessages((prev) => [
        ...prev,
        { role: "assistant", content: `エラー: ${text}` },
      ]);
    } finally {
      setBusy(false);
    }
  };

  const handleApply = async () => {
    if (!projectId || !proposal) return;
    setBusy(true);
    setErrorMessage(null);
    setSuccessMessage(null);
    setLastIntent(null);
    try {
      const generation = (await refreshGeneration()) ?? baseGeneration;
      if (!generation) {
        throw new Error("generation を取得できませんでした");
      }
      await applyAiProposal(projectId, {
        proposedYaml: proposal.proposedYaml,
        expectedGeneration: generation,
        instruction: lastUserInstruction,
      });
      setProposal(null);
      setWorkingFrom("definition");
      setSuccessMessage("tests.yml を適用しました。");
      setChatMessages((prev) => [
        ...prev,
        { role: "assistant", content: "編集案を適用しました。" },
      ]);
      await refreshGeneration();
      await loadRevisions();
    } catch (err) {
      setErrorMessage(err instanceof ApiError ? err.message : "適用に失敗しました");
    } finally {
      setBusy(false);
    }
  };

  const handleDiscard = () => {
    setProposal(null);
    setWorkingFrom("definition");
    setErrorMessage(null);
  };

  const handleReset = () => {
    if (!projectId) return;
    setChatMessages([]);
    setProposal(null);
    setWorkingFrom("definition");
    setInput("");
    setErrorMessage(null);
    setSuccessMessage(null);
    setLastIntent(null);
    clearAiSession(projectId);
    void refreshGeneration();
  };

  const handleRestore = async (revisionId: string) => {
    if (!projectId) return;
    setBusy(true);
    setErrorMessage(null);
    setSuccessMessage(null);
    setLastIntent(null);
    try {
      const generation = (await refreshGeneration()) ?? baseGeneration;
      if (!generation) throw new Error("generation を取得できませんでした");
      await restoreDefinitionRevision(projectId, revisionId, generation);
      setProposal(null);
      setWorkingFrom("definition");
      setSuccessMessage("以前の tests.yml に復元しました。");
      await refreshGeneration();
      await loadRevisions();
    } catch (err) {
      setErrorMessage(err instanceof ApiError ? err.message : "復元に失敗しました");
    } finally {
      setBusy(false);
    }
  };

  if (!definition) return null;

  return (
    <>
      <AppNav />
      <main className="mx-auto flex h-[calc(100svh-0px)] max-w-6xl flex-col gap-3 px-4 py-6 pb-8">
        <div>
          <h1 className="text-lg font-semibold">AI 編集</h1>
          <p className="text-sm text-muted-foreground">
            {definition.project.name} — tests.yml を質問・編集
          </p>
          {syncNotice ? (
            <p className="mt-2 text-sm text-amber-800">{syncNotice}</p>
          ) : null}
        </div>

        <div className="grid min-h-0 flex-1 gap-4 lg:grid-cols-2">
          <TestsYamlAiChatPanel
            messages={chatMessages}
            input={input}
            busy={busy}
            onInputChange={setInput}
            onSend={() => void handleSend()}
            onReset={handleReset}
          />
          <TestsYamlAiProposalPanel
            proposal={proposal}
            editIntentWithoutProposal={lastIntent === "edit" && proposal == null}
            baseDefinition={definition}
            busy={busy}
            successMessage={successMessage}
            errorMessage={errorMessage}
            revisions={revisions}
            onApply={() => void handleApply()}
            onDiscard={handleDiscard}
            onRestore={(revisionId) => void handleRestore(revisionId)}
          />
        </div>
      </main>
    </>
  );
}

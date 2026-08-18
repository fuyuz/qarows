import { useCallback, useEffect, useMemo, useState } from "react";
import { getClientI18n, serializeTestsYaml, type TestDefinition } from "@qarows/shared";
import { ApiError } from "@/lib/api/client";
import { getProject } from "@/lib/api/projects";
import {
  listDefinitionRevisions,
  proposeAiEdit,
  restoreDefinitionRevision,
  type AiChatMessage,
  type AiIntent,
  type AiProposal,
  type DefinitionRevisionSummary,
} from "@/lib/api/ai";
import { clearAiSession, loadAiSession, saveAiSession } from "@/lib/ai-session-storage";

export function useTestsYamlAiEdit({
  enabled = true,
  projectId,
  definition,
  draft,
  draftHasChanges = false,
}: {
  enabled?: boolean;
  projectId: string | undefined;
  definition: TestDefinition | null;
  /** Current editor draft — used as AI base when it has local changes */
  draft: TestDefinition | null;
  /** Only then is draft serialized into the propose body (avoids 413 on large YAML). */
  draftHasChanges?: boolean;
}) {
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
    if (!enabled || !projectId) return;
    try {
      const data = await listDefinitionRevisions(projectId);
      setRevisions(data.revisions);
    } catch {
      // non-fatal
    }
  }, [enabled, projectId]);

  const refreshGeneration = useCallback(async () => {
    if (!enabled || !projectId) return null;
    const snapshot = await getProject(projectId);
    setBaseGeneration(snapshot.generation ?? "");
    return snapshot.generation ?? "";
  }, [enabled, projectId]);

  useEffect(() => {
    if (!enabled || !projectId) return;
    const saved = loadAiSession(projectId);
    if (saved) {
      setChatMessages(saved.chatMessages);
      // Drop legacy proposals without server proposalId (cannot be applied via /ai/apply).
      const savedProposal =
        saved.proposal && typeof saved.proposal.proposalId === "string"
          ? saved.proposal
          : null;
      setProposal(savedProposal);
      setWorkingFrom(savedProposal ? saved.workingFrom : "definition");
      setBaseGeneration(saved.baseGeneration);
    }
    void refreshGeneration();
    void loadRevisions();
  }, [enabled, projectId, refreshGeneration, loadRevisions]);

  useEffect(() => {
    if (!enabled || !projectId) return;
    saveAiSession(projectId, {
      chatMessages,
      proposal,
      workingFrom,
      baseGeneration,
    });
  }, [enabled, projectId, chatMessages, proposal, workingFrom, baseGeneration]);

  const handleSend = useCallback(async () => {
    if (!enabled || !projectId || !definition || !input.trim() || busy) return;
    const { t } = getClientI18n();
    const message = input.trim();
    setInput("");
    setErrorMessage(null);
    setSuccessMessage(null);
    setLastIntent(null);

    const nextHistory: AiChatMessage[] = [...chatMessages, { role: "user", content: message }];
    setChatMessages(nextHistory);
    setBusy(true);

    try {
      // Prefer server-stored proposal id over resending YAML.
      // Only send baseYaml when the editor draft differs from the saved definition.
      const response = await proposeAiEdit(projectId, {
        message,
        history: chatMessages,
        workingFrom: proposal ? "proposal" : "definition",
        baseProposalId: proposal?.proposalId,
        baseYaml:
          draftHasChanges && draft ? serializeTestsYaml(draft) : undefined,
      });

      setChatMessages((prev) => [...prev, { role: "assistant", content: response.reply }]);
      setLastIntent(response.intent);
      if (response.proposal) {
        setProposal(response.proposal);
        setWorkingFrom("proposal");
      }
    } catch (err) {
      const text = err instanceof ApiError ? err.message : t("ai.requestFailed");
      setErrorMessage(text);
      setChatMessages((prev) => [
        ...prev,
        { role: "assistant", content: t("ai.errorPrefix", { text }) },
      ]);
    } finally {
      setBusy(false);
    }
  }, [enabled, projectId, definition, draft, draftHasChanges, input, busy, chatMessages, proposal]);

  const handleDiscardProposal = useCallback(() => {
    setProposal(null);
    setWorkingFrom("definition");
    setErrorMessage(null);
    setLastIntent(null);
  }, []);

  const handleReset = useCallback(() => {
    if (!enabled || !projectId) return;
    setChatMessages([]);
    setProposal(null);
    setWorkingFrom("definition");
    setInput("");
    setErrorMessage(null);
    setSuccessMessage(null);
    setLastIntent(null);
    clearAiSession(projectId);
    void refreshGeneration();
  }, [enabled, projectId, refreshGeneration]);

  const handleRestore = useCallback(
    async (revisionId: string) => {
      if (!enabled || !projectId) return;
      const { t } = getClientI18n();
      setBusy(true);
      setErrorMessage(null);
      setSuccessMessage(null);
      setLastIntent(null);
      try {
        const generation = (await refreshGeneration()) ?? baseGeneration;
        if (!generation) throw new Error(t("error.noGenerationShort"));
        await restoreDefinitionRevision(projectId, revisionId, generation);
        setProposal(null);
        setWorkingFrom("definition");
        setSuccessMessage(t("ai.restoredYaml"));
        await refreshGeneration();
        await loadRevisions();
      } catch (err) {
        setErrorMessage(err instanceof ApiError ? err.message : t("ai.restoreFailed"));
      } finally {
        setBusy(false);
      }
    },
    [enabled, projectId, refreshGeneration, baseGeneration, loadRevisions],
  );

  const acceptProposalIntoDraft = useCallback(() => {
    if (!enabled || !proposal) return null;
    const { t } = getClientI18n();
    const accepted = proposal.proposedDefinition;
    setProposal(null);
    setWorkingFrom("definition");
    // Clear so the "diff を生成できませんでした" alert does not appear after a successful reflect.
    setLastIntent(null);
    setSuccessMessage(t("ai.reflectedReview"));
    setChatMessages((prev) => [
      ...prev,
      { role: "assistant", content: t("ai.reflectedApply") },
    ]);
    return accepted;
  }, [enabled, proposal]);

  // Only when the latest propose returned edit intent but no proposal (not after accept/discard).
  const editIntentWithoutProposal = useMemo(
    () => lastIntent === "edit" && proposal == null,
    [lastIntent, proposal],
  );

  return {
    chatMessages,
    proposal,
    input,
    setInput,
    busy,
    successMessage,
    errorMessage,
    revisions,
    editIntentWithoutProposal,
    handleSend,
    handleDiscardProposal,
    handleReset,
    handleRestore,
    acceptProposalIntoDraft,
    refreshGeneration,
    loadRevisions,
  };
}

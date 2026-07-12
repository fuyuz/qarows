import { useCallback, useEffect, useRef, useState, type PointerEvent as ReactPointerEvent } from "react";
import { serializeTestsYaml, type TestDefinition } from "@qarows/shared";
import {
  TestsEditPageLayout,
  type TestsEditDraftImport,
  type TestsEditDraftState,
} from "@qarows/runner-ui";
import { Button, cn } from "@qarows/ui";
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

type AiAsideSection = "chat" | "proposal";

const AI_PANEL_WIDTH_KEY = "qarows:v2:ai-panel-width";
const AI_PANEL_DEFAULT_WIDTH = 416;
const AI_PANEL_MIN_WIDTH = 280;
const AI_PANEL_MAX_WIDTH = 720;
/** Floor when the viewport cannot fit the normal minimum. */
const AI_PANEL_NARROW_FLOOR = 200;
/** Keep enough room for the definition editor column. */
const EDITOR_MIN_WIDTH_PX = 320;
/** Approximate width of sync indicator + compass button. */
const NAV_CLUSTER_WIDTH_PX = 96;
/** Matches Tailwind `right-5` (1.25rem) gap outside the AI panel. */
const NAV_RIGHT_GAP_PX = 20;

function viewportWidth(): number {
  return typeof window !== "undefined" ? window.innerWidth : 1280;
}

/** Max panel width that keeps the fixed nav and a usable editor on-screen. */
function maxAiPanelWidthForViewport(vw = viewportWidth()): number {
  const available = vw - EDITOR_MIN_WIDTH_PX - NAV_CLUSTER_WIDTH_PX - NAV_RIGHT_GAP_PX;
  if (available < AI_PANEL_MIN_WIDTH) {
    // Prefer the narrow floor when there's room, but never exceed available space.
    return Math.max(0, Math.min(AI_PANEL_NARROW_FLOOR, available));
  }
  return Math.min(AI_PANEL_MAX_WIDTH, available);
}

function minAiPanelWidthForViewport(vw = viewportWidth()): number {
  return Math.min(AI_PANEL_MIN_WIDTH, maxAiPanelWidthForViewport(vw));
}

function clampAiPanelWidth(width: number, vw = viewportWidth()): number {
  const min = minAiPanelWidthForViewport(vw);
  const max = maxAiPanelWidthForViewport(vw);
  return Math.min(max, Math.max(min, Math.round(width)));
}

function loadAiPanelWidth(): number {
  try {
    const raw = localStorage.getItem(AI_PANEL_WIDTH_KEY);
    if (!raw) return clampAiPanelWidth(AI_PANEL_DEFAULT_WIDTH);
    const parsed = Number(raw);
    if (!Number.isFinite(parsed)) return clampAiPanelWidth(AI_PANEL_DEFAULT_WIDTH);
    return clampAiPanelWidth(parsed);
  } catch {
    return clampAiPanelWidth(AI_PANEL_DEFAULT_WIDTH);
  }
}

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
  const [aiSection, setAiSection] = useState<AiAsideSection>("chat");
  const [aiPanelWidth, setAiPanelWidth] = useState(loadAiPanelWidth);
  const [aiResizing, setAiResizing] = useState(false);
  const [importToken, setImportToken] = useState(0);
  const resizeStartRef = useRef<{ x: number; width: number } | null>(null);

  // AI 無効 / 未判定中はフックを動かさない（sessionStorage・revisions API を叩かない）
  const aiActive = aiLoaded && aiEnabled;

  const ai = useTestsYamlAiEdit({
    enabled: aiActive,
    projectId,
    definition,
    draft: draftState.draft,
    draftHasChanges: draftState.hasChanges,
  });

  // 編集案（または生成失敗）が来たら編集案パネルへフォーカス
  useEffect(() => {
    if (!aiActive) return;
    if (ai.proposal || ai.editIntentWithoutProposal) {
      setAiSection("proposal");
    }
  }, [aiActive, ai.proposal, ai.editIntentWithoutProposal]);

  useEffect(() => {
    try {
      localStorage.setItem(AI_PANEL_WIDTH_KEY, String(aiPanelWidth));
    } catch {
      // ignore quota / private mode
    }
  }, [aiPanelWidth]);

  // Keep panel + shifted nav within the viewport when the window is resized.
  useEffect(() => {
    const onResize = () => {
      setAiPanelWidth((width) => clampAiPanelWidth(width));
    };
    onResize();
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, []);

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
        throw new Error(err instanceof ApiError ? err.message : "定義の適用に失敗しました", {
          cause: err,
        });
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

  const handleResizePointerDown = useCallback(
    (event: ReactPointerEvent<HTMLDivElement>) => {
      event.preventDefault();
      resizeStartRef.current = { x: event.clientX, width: aiPanelWidth };
      setAiResizing(true);
      event.currentTarget.setPointerCapture(event.pointerId);
    },
    [aiPanelWidth],
  );

  const handleResizePointerMove = useCallback((event: ReactPointerEvent<HTMLDivElement>) => {
    const start = resizeStartRef.current;
    if (!start) return;
    // Dragging the left edge leftward widens the panel.
    const next = clampAiPanelWidth(start.width + (start.x - event.clientX));
    setAiPanelWidth(next);
  }, []);

  const handleResizePointerUp = useCallback((event: ReactPointerEvent<HTMLDivElement>) => {
    if (!resizeStartRef.current) return;
    resizeStartRef.current = null;
    setAiResizing(false);
    try {
      event.currentTarget.releasePointerCapture(event.pointerId);
    } catch {
      // already released
    }
  }, []);

  if (!definition || !projectId) return null;

  const panelMinWidth = minAiPanelWidthForViewport();
  const panelMaxWidth = maxAiPanelWidthForViewport();
  const navOffsetRight =
    aiActive && aiOpen ? aiPanelWidth + NAV_RIGHT_GAP_PX : undefined;

  const aiAside =
    aiActive && aiOpen ? (
      <aside
        className={cn(
          "relative flex shrink-0 flex-col gap-3 border-l border-border/80 bg-background p-3",
          aiResizing && "select-none",
        )}
        style={{ width: aiPanelWidth }}
      >
        <div
          role="separator"
          aria-orientation="vertical"
          aria-label="AI パネルの幅を変更"
          aria-valuemin={panelMinWidth}
          aria-valuemax={panelMaxWidth}
          aria-valuenow={aiPanelWidth}
          tabIndex={0}
          className={cn(
            "absolute inset-y-0 left-0 z-20 w-1.5 -translate-x-1/2 cursor-col-resize touch-none",
            "bg-transparent hover:bg-primary/25 focus-visible:bg-primary/40",
            aiResizing && "bg-primary/40",
          )}
          onPointerDown={handleResizePointerDown}
          onPointerMove={handleResizePointerMove}
          onPointerUp={handleResizePointerUp}
          onPointerCancel={handleResizePointerUp}
          onKeyDown={(event) => {
            if (event.key === "ArrowLeft") {
              event.preventDefault();
              setAiPanelWidth((w) => clampAiPanelWidth(w + 16));
            } else if (event.key === "ArrowRight") {
              event.preventDefault();
              setAiPanelWidth((w) => clampAiPanelWidth(w - 16));
            }
          }}
        />
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
        <div className="flex min-h-0 flex-1 flex-col gap-2 overflow-hidden">
          <TestsYamlAiChatPanel
            messages={ai.chatMessages}
            input={ai.input}
            busy={ai.busy}
            expanded={aiSection === "chat"}
            onExpand={() => setAiSection("chat")}
            onInputChange={ai.setInput}
            onSend={() => void ai.handleSend()}
            onReset={ai.handleReset}
          />
          <TestsYamlAiProposalPanel
            proposal={ai.proposal}
            editIntentWithoutProposal={ai.editIntentWithoutProposal}
            baseDefinition={draftState.draft ?? definition}
            busy={ai.busy}
            expanded={aiSection === "proposal"}
            onExpand={() => setAiSection("proposal")}
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
      navSlot={<AppNav offsetRight={navOffsetRight} />}
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

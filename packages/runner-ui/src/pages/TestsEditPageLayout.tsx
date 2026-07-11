import { useCallback, useEffect, useMemo, useState, type ReactNode } from "react";
import { useBlocker } from "react-router-dom";
import {
  parseTestsYaml,
  serializeTestsYaml,
  type TestDefinition,
} from "@qarows/shared";
import {
  Alert,
  AlertDescription,
  Button,
  DefinitionDiffView,
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  cn,
} from "@qarows/ui";
import { useDefinitionDraft } from "../hooks/useDefinitionDraft";
import {
  DefinitionEditFilterBar,
  filterDefinitionTestCases,
  useDefinitionEditFilters,
} from "../components/DefinitionEditFilterBar";
import { DefinitionEnvironmentsPanel } from "../components/DefinitionEnvironmentsPanel";
import { TestCaseEditCard } from "../components/TestCaseEditCard";

export interface TestsEditDraftImport {
  definition: TestDefinition;
  token: number;
}

export interface TestsEditDraftState {
  hasChanges: boolean;
  draft: TestDefinition | null;
}

export function TestsEditPageLayout({
  definition,
  onApply,
  navSlot,
  asideSlot,
  syncKey,
  draftImport,
  onDraftImportConsumed,
  onDraftStateChange,
}: {
  definition: TestDefinition;
  onApply: (next: TestDefinition) => Promise<void>;
  navSlot?: ReactNode;
  asideSlot?: ReactNode;
  /** When this changes (e.g. Team revision), reset draft from saved definition */
  syncKey?: string | number | null;
  draftImport?: TestsEditDraftImport | null;
  onDraftImportConsumed?: () => void;
  onDraftStateChange?: (state: TestsEditDraftState) => void;
}) {
  const draftApi = useDefinitionDraft(definition, { syncKey });
  const [filters, setFilters] = useDefinitionEditFilters();
  const [compact, setCompact] = useState(false);
  const [diffOpen, setDiffOpen] = useState(false);
  const [applyError, setApplyError] = useState<string | null>(null);
  const [applying, setApplying] = useState(false);

  const { draft, diff, hasChanges, changeSummary, discard, markApplied, replaceDraft } = draftApi;

  useEffect(() => {
    onDraftStateChange?.({ hasChanges, draft });
  }, [hasChanges, draft, onDraftStateChange]);

  useEffect(() => {
    if (!draftImport) return;
    replaceDraft(draftImport.definition);
    onDraftImportConsumed?.();
  }, [draftImport, replaceDraft, onDraftImportConsumed]);

  const filtered = useMemo(() => {
    if (!draft) return [];
    return filterDefinitionTestCases(draft, filters);
  }, [draft, filters]);

  const blocker = useBlocker(hasChanges);

  useEffect(() => {
    if (blocker.state !== "blocked") return;
    const ok = window.confirm("未適用の変更があります。破棄して移動しますか？");
    if (ok) {
      discard();
      blocker.proceed();
    } else {
      blocker.reset();
    }
  }, [blocker, discard]);

  useEffect(() => {
    if (!hasChanges) return;
    const onBeforeUnload = (event: BeforeUnloadEvent) => {
      event.preventDefault();
      event.returnValue = "";
    };
    window.addEventListener("beforeunload", onBeforeUnload);
    return () => window.removeEventListener("beforeunload", onBeforeUnload);
  }, [hasChanges]);

  const handleApply = useCallback(async () => {
    if (!draft) return;
    setApplyError(null);
    setApplying(true);
    try {
      const normalized = parseTestsYaml(serializeTestsYaml(draft));
      await onApply(normalized);
      markApplied(normalized);
      setDiffOpen(false);
    } catch (error) {
      setApplyError(error instanceof Error ? error.message : "適用に失敗しました");
    } finally {
      setApplying(false);
    }
  }, [draft, markApplied, onApply]);

  const handleDiscard = useCallback(() => {
    if (!hasChanges) return;
    if (!window.confirm("未適用の変更をすべて破棄しますか？")) return;
    discard();
    setApplyError(null);
  }, [discard, hasChanges]);

  if (!draft) return null;

  const editorColumn = (
    <div className="relative flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden">
      <DefinitionEditFilterBar
        definition={draft}
        filters={filters}
        onChange={setFilters}
        filteredCount={filtered.length}
        compact={compact}
        onCompactChange={setCompact}
        onAddTestCase={() => {
          const major = filters.major ?? "未分類";
          draftApi.addTestCase({
            category: {
              major,
              ...(filters.medium ? { medium: filters.medium } : {}),
              ...(filters.medium && filters.minor ? { minor: filters.minor } : {}),
            },
            description: "",
          });
        }}
      />

      <main className="mx-auto flex min-h-0 w-full max-w-3xl flex-1 flex-col overflow-y-auto px-5 py-4 pb-28">
        {!compact ? (
          <div className="mb-4 shrink-0">
            <h1 className="mb-1 text-lg font-bold tracking-tight">テスト定義</h1>
            <p className="text-xs text-muted-foreground">
              変更は一時状態として保持されます。Apply するまで保存済み定義には反映されません。
            </p>
          </div>
        ) : null}

        {!compact ? (
          <DefinitionEnvironmentsPanel
            className="mb-4 shrink-0"
            environments={draft.environments}
            onUpdate={draftApi.updateEnvironment}
            onAdd={draftApi.addEnvironment}
            onRemove={draftApi.removeEnvironment}
          />
        ) : null}

        {applyError ? (
          <Alert variant="destructive" className="mb-4">
            <AlertDescription>{applyError}</AlertDescription>
          </Alert>
        ) : null}

        <div className={cn("flex flex-col", compact ? "gap-2" : "gap-4")}>
          {filtered.length === 0 ? (
            <p className="py-8 text-center text-sm text-muted-foreground">
              条件に一致するテストケースがありません
            </p>
          ) : (
            filtered.map((tc) => (
              <TestCaseEditCard
                key={tc.id}
                testCase={tc}
                definition={draft}
                compact={compact}
                modified={draftApi.isTestCaseModified(tc.id)}
                isNew={draftApi.isTestCaseNew(tc.id)}
                onUpdate={(patch) => draftApi.updateTestCase(tc.id, patch)}
                onChangeId={(newId) => draftApi.setTestCaseId(tc.id, newId)}
                onSetTargets={(spec) => draftApi.setTestCaseTargets(tc.id, spec)}
                onRemove={() => draftApi.removeTestCase(tc.id)}
              />
            ))
          )}
        </div>
      </main>

      <div
        className={cn(
          "absolute inset-x-0 bottom-0 z-30 border-t border-border/80 bg-background/95 px-5 py-3 backdrop-blur",
          hasChanges && "border-amber-300/60",
        )}
      >
        <div className="mx-auto flex w-full max-w-3xl flex-wrap items-center gap-2">
          <p className="mr-auto text-sm text-muted-foreground">
            {hasChanges ? changeSummary : "未適用の変更はありません"}
          </p>
          <Button
            type="button"
            size="sm"
            variant="outline"
            disabled={!hasChanges || !diff}
            onClick={() => setDiffOpen(true)}
          >
            Diff
          </Button>
          <Button
            type="button"
            size="sm"
            variant="ghost"
            disabled={!hasChanges || applying}
            onClick={handleDiscard}
          >
            Discard
          </Button>
          <Button
            type="button"
            size="sm"
            disabled={!hasChanges || applying}
            onClick={() => void handleApply()}
          >
            {applying ? "適用中…" : "Apply"}
          </Button>
        </div>
      </div>

      <Sheet open={diffOpen} onOpenChange={setDiffOpen}>
        <SheetContent className="w-full overflow-y-auto sm:max-w-lg">
          <SheetHeader>
            <SheetTitle>変更差分</SheetTitle>
            <SheetDescription>Apply すると保存済みのテスト定義に反映されます。</SheetDescription>
          </SheetHeader>
          <div className="mt-4 px-1 pb-6">
            {diff ? <DefinitionDiffView diff={diff} /> : null}
          </div>
        </SheetContent>
      </Sheet>
    </div>
  );

  return (
    <div className="flex h-svh overflow-hidden">
      {navSlot}
      {editorColumn}
      {asideSlot}
    </div>
  );
}

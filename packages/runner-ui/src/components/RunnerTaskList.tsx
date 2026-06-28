import { useEffect, useMemo, useRef, useState, type RefObject } from "react";
import type { ResultsFile, SessionConfig, TestCase, TestDefinition } from "@qarows/shared";
import {
  getRunnerTargetMode,
  getTestCaseAggregateStatus,
  resolveRunnerTestCases,
} from "@qarows/shared";
import { Button } from "@qarows/ui";
import { ScrollArea } from "@qarows/ui";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@qarows/ui";
import { useRunnerWorkspace } from "../context/runner-workspace";
import { useRunnerQueryState } from "../hooks/useRunnerQueryState";
import { formatRunnerFilterTitle } from "../lib/runner-utils";
import { cn } from "@qarows/ui";

function formatCategory(testCase: TestCase): string {
  const parts = [testCase.category.major];
  if (testCase.category.medium) parts.push(testCase.category.medium);
  if (testCase.category.minor) parts.push(testCase.category.minor);
  return parts.join(" › ");
}

function statusClass(status: ReturnType<typeof getTestCaseAggregateStatus>): string {
  if (status === "incomplete") return "text-muted-foreground";
  if (status === "OK") return "text-green-600";
  if (status === "NG") return "text-red-600";
  return "text-stone-500";
}

function statusSymbol(status: ReturnType<typeof getTestCaseAggregateStatus>): string {
  if (status === "incomplete") return "○";
  if (status === "OK") return "✓";
  if (status === "NG") return "✗";
  return "–";
}

const TASK_BAR_ANIM_MS = 320;

function TaskListPanel({
  headerTitle,
  headerDescription,
  descriptionExpanded,
  onToggleDescription,
  completedCount,
  targets,
  definition,
  session,
  results,
  runnerIndex,
  lastUpdatedTestId,
  onJump,
  listRef,
  itemRefs,
  className,
}: {
  headerTitle: string;
  headerDescription?: string;
  descriptionExpanded: boolean;
  onToggleDescription: () => void;
  completedCount: number;
  targets: TestCase[];
  definition: TestDefinition;
  session: SessionConfig;
  results: ResultsFile;
  runnerIndex: number;
  lastUpdatedTestId: string | null;
  onJump: (index: number) => void;
  listRef: RefObject<HTMLUListElement | null>;
  itemRefs: RefObject<(HTMLLIElement | null)[]>;
  className?: string;
}) {
  const prevRunnerIndexRef = useRef(runnerIndex);
  const [barPhase, setBarPhase] = useState<Record<number, "enter" | "exit">>({});

  useEffect(() => {
    const prev = prevRunnerIndexRef.current;
    if (prev === runnerIndex) return;

    const nextPhase: Record<number, "enter" | "exit"> = {};
    if (prev >= 0) nextPhase[prev] = "exit";
    if (runnerIndex >= 0) nextPhase[runnerIndex] = "enter";
    setBarPhase(nextPhase);

    const timer = window.setTimeout(() => setBarPhase({}), TASK_BAR_ANIM_MS);
    prevRunnerIndexRef.current = runnerIndex;
    return () => window.clearTimeout(timer);
  }, [runnerIndex]);

  return (
    <aside className={cn("flex flex-col overflow-hidden rounded-xl border bg-muted/30", className)} aria-label="テスト一覧">
      <div className="shrink-0 border-b bg-card px-3.5 py-3">
        <h2 className="text-sm font-bold leading-snug">{headerTitle}</h2>
        {headerDescription && (
          <div className="mt-1.5">
            <p
              className={cn(
                "text-xs leading-relaxed text-muted-foreground",
                !descriptionExpanded && "line-clamp-3",
              )}
            >
              {headerDescription}
            </p>
            {headerDescription.length > 80 && (
              <button
                type="button"
                className="mt-1 text-xs font-semibold text-primary"
                onClick={onToggleDescription}
              >
                {descriptionExpanded ? "閉じる" : "続きを読む"}
              </button>
            )}
          </div>
        )}
        <p
          key={`${completedCount}-${targets.length}`}
          className="mt-2 animate-in fade-in duration-200 text-xs font-semibold text-muted-foreground tabular-nums"
        >
          <span className="text-foreground">{completedCount}</span> / {targets.length} 完了
        </p>
      </div>

      <ScrollArea className="min-h-0 flex-1">
        <ul ref={listRef} className="py-1">
          {targets.length === 0 ? (
            <li className="px-3.5 py-4 text-sm text-muted-foreground">対象テストがありません</li>
          ) : (
            targets.map((testCase, index) => {
              const status = getTestCaseAggregateStatus(
                testCase,
                definition,
                session.selectedEnvironmentIds,
                results.results,
              );
              const isActive = runnerIndex === index && runnerIndex >= 0;
              const phase = barPhase[index];
              const showBar = isActive || phase === "exit";
              const wasJustUpdated = lastUpdatedTestId === testCase.id;
              const rowHighlight =
                wasJustUpdated && status === "NG"
                  ? "animate-ui-highlight-ng"
                  : wasJustUpdated && status === "OK"
                    ? "animate-ui-highlight-ok"
                    : wasJustUpdated
                      ? "animate-ui-highlight"
                      : undefined;

              return (
                <li
                  key={testCase.id}
                  ref={(el) => {
                    itemRefs.current[index] = el;
                  }}
                  className={cn(
                    "relative transition-[background-color] duration-500 ease-in-out motion-reduce:transition-none",
                    isActive && "bg-primary/5",
                    status === "NG" && !isActive && "bg-red-50/40",
                    rowHighlight,
                  )}
                >
                  {showBar && (
                    <span
                      aria-hidden
                      className={cn(
                        "pointer-events-none absolute inset-y-0 left-0 z-10 w-[3px] rounded-r bg-primary",
                        phase === "exit" && "animate-task-bar-exit",
                        phase === "enter" && "animate-task-bar-enter",
                      )}
                    />
                  )}
                  <button
                    type="button"
                    className="relative z-[1] flex w-full items-start gap-2 px-3 py-2.5 text-left hover:bg-muted/50"
                    onClick={() => onJump(index)}
                  >
                    <span
                      key={status}
                      className={cn(
                        "w-4 shrink-0 text-center text-xs font-bold transition-colors duration-300 ease-out motion-reduce:transition-none",
                        statusClass(status),
                        wasJustUpdated && "animate-task-status-pop",
                      )}
                    >
                      {statusSymbol(status)}
                    </span>
                    <span className="min-w-0">
                      <span className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
                        <span className="text-[0.72rem] font-bold text-primary">{testCase.id}</span>
                        <span className="text-[0.68rem] text-muted-foreground">{formatCategory(testCase)}</span>
                      </span>
                      <span className="mt-0.5 line-clamp-3 text-xs leading-relaxed text-foreground/80">
                        {testCase.description}
                      </span>
                    </span>
                  </button>
                </li>
              );
            })
          )}
        </ul>
      </ScrollArea>
    </aside>
  );
}

export function RunnerTaskList() {
  const { definition, results, session, lastUpdatedTestId } = useRunnerWorkspace();
  const { runnerFilters, testId, setTestId } = useRunnerQueryState();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [descriptionExpanded, setDescriptionExpanded] = useState(false);
  const listRef = useRef<HTMLUListElement>(null);
  const itemRefs = useRef<(HTMLLIElement | null)[]>([]);

  const targets = useMemo(() => {
    if (!definition || !results || !session) return [];
    return resolveRunnerTestCases(definition, session, runnerFilters, results.results);
  }, [definition, results, session, runnerFilters]);

  const runnerIndex = useMemo(() => {
    if (!testId) return -1;
    const index = targets.findIndex((tc) => tc.id === testId);
    return index >= 0 ? index : -1;
  }, [targets, testId]);

  const mode = getRunnerTargetMode(runnerFilters);
  const scenario =
    mode === "scenario"
      ? definition?.scenarios?.find((entry) => entry.id === runnerFilters.scenarioId)
      : undefined;

  const completedCount = useMemo(() => {
    if (!definition || !results || !session) return 0;
    return targets.filter(
      (testCase) =>
        getTestCaseAggregateStatus(
          testCase,
          definition,
          session.selectedEnvironmentIds,
          results.results,
        ) !== "incomplete",
    ).length;
  }, [definition, results, session, targets]);

  useEffect(() => {
    itemRefs.current[runnerIndex]?.scrollIntoView({ block: "nearest", behavior: "smooth" });
  }, [runnerIndex, targets.length]);

  if (!definition || !session || !results) return null;

  const jumpToTest = (index: number) => {
    const testCase = targets[index];
    if (testCase) void setTestId(testCase.id);
    setMobileOpen(false);
  };

  const headerTitle =
    mode === "scenario" && scenario ? scenario.name : formatRunnerFilterTitle(definition, runnerFilters);

  const headerDescription =
    mode === "scenario" && scenario?.description ? scenario.description.trim() : undefined;

  const panelProps = {
    headerTitle,
    headerDescription,
    descriptionExpanded,
    onToggleDescription: () => setDescriptionExpanded((expanded) => !expanded),
    completedCount,
    targets,
    definition,
    session,
    results,
    runnerIndex,
    lastUpdatedTestId,
    onJump: jumpToTest,
    listRef,
    itemRefs,
  };

  return (
    <>
      <Button
        type="button"
        variant="outline"
        size="sm"
        className="mb-2 md:hidden"
        onClick={() => setMobileOpen(true)}
      >
        テスト一覧 ({targets.length})
      </Button>

      <TaskListPanel
        {...panelProps}
        className="hidden h-full min-h-0 w-84 shrink-0 md:flex"
      />

      <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
        <SheetContent side="left" className="w-[min(100vw-1.5rem,22rem)] p-0">
          <SheetHeader className="sr-only">
            <SheetTitle>テスト一覧</SheetTitle>
          </SheetHeader>
          <TaskListPanel {...panelProps} className="h-full border-0 rounded-none bg-background" />
        </SheetContent>
      </Sheet>
    </>
  );
}

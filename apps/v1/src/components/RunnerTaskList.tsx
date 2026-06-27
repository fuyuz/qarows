import { useEffect, useMemo, useRef, useState, type RefObject } from "react";
import type { ResultsFile, SessionConfig, TestCase, TestDefinition } from "@qarows/shared";
import {
  getRunnerTargetMode,
  getTestCaseAggregateStatus,
  resolveRunnerTestCases,
} from "@qarows/shared";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { useApp } from "@/context/AppContext";
import { formatRunnerFilterTitle } from "@/lib/utils";
import { cn } from "@/lib/cn";

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
  if (status === "SKIP") return "text-stone-500";
  return "text-orange-600";
}

function statusSymbol(status: ReturnType<typeof getTestCaseAggregateStatus>): string {
  if (status === "incomplete") return "○";
  if (status === "OK") return "✓";
  if (status === "NG") return "✗";
  if (status === "SKIP") return "–";
  return "!";
}

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
  activeItemRef,
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
  activeItemRef: RefObject<HTMLLIElement | null>;
  className?: string;
}) {
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
                  ref={isActive ? activeItemRef : undefined}
                  className={cn(
                    isActive && "border-l-[3px] border-l-primary bg-primary/5",
                    status === "NG" && !isActive && "bg-red-50/40",
                    rowHighlight,
                  )}
                >
                  <button
                    type="button"
                    className="flex w-full items-start gap-2 px-3 py-2.5 text-left hover:bg-muted/50"
                    onClick={() => onJump(index)}
                  >
                    <span className={cn("w-4 shrink-0 text-center text-xs font-bold", statusClass(status))}>
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
  const { definition, results, session, runnerFilters, runnerIndex, setRunnerIndex, lastUpdatedTestId } =
    useApp();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [descriptionExpanded, setDescriptionExpanded] = useState(false);
  const listRef = useRef<HTMLUListElement>(null);
  const activeItemRef = useRef<HTMLLIElement>(null);

  const targets = useMemo(() => {
    if (!definition || !results || !session) return [];
    return resolveRunnerTestCases(definition, session, runnerFilters, results.results);
  }, [definition, results, session, runnerFilters]);

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
    activeItemRef.current?.scrollIntoView({ block: "nearest", behavior: "smooth" });
  }, [runnerIndex, targets.length]);

  if (!definition || !session || !results) return null;

  const jumpToTest = (index: number) => {
    void setRunnerIndex(index);
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
    activeItemRef,
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
        className="hidden h-[var(--run-main-height,calc(100vh-9rem))] w-84 shrink-0 md:flex"
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

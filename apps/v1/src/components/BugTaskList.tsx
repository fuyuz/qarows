import { useEffect, useMemo, useRef, useState, type RefObject } from "react";
import { BUG_SEVERITY_LABELS, BUG_STATUS_LABELS, getRunnerTargetMode, isBugClosed, type Bug, type TestDefinition } from "@qarows/shared";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { useApp } from "@/context/AppContext";
import { useRunnerQueryState } from "@/hooks/useRunnerQueryState";
import { resolveFilteredBugs } from "@/lib/bug-filter";
import { getAllEnvironmentIds } from "@/lib/run-progress";
import { formatRunnerFilterTitle } from "@/lib/utils";
import { cn } from "@/lib/cn";

const TASK_BAR_ANIM_MS = 320;

function statusSymbol(status: Bug["status"]): string {
  if (status === "resolved") return "✓";
  if (status === "wont_fix") return "—";
  if (status === "fixed") return "◐";
  if (status === "in_progress") return "▶";
  return "●";
}

function statusClass(status: Bug["status"]): string {
  if (status === "resolved") return "text-green-600";
  if (status === "wont_fix") return "text-stone-500";
  if (status === "fixed") return "text-blue-600";
  if (status === "in_progress") return "text-orange-600";
  return "text-red-600";
}

function BugListPanel({
  headerTitle,
  headerDescription,
  descriptionExpanded,
  onToggleDescription,
  openCount,
  targets,
  definition,
  bugIndex,
  onJump,
  listRef,
  itemRefs,
  className,
}: {
  headerTitle: string;
  headerDescription?: string;
  descriptionExpanded: boolean;
  onToggleDescription: () => void;
  openCount: number;
  targets: Bug[];
  definition: TestDefinition;
  bugIndex: number;
  onJump: (index: number) => void;
  listRef: RefObject<HTMLUListElement | null>;
  itemRefs: RefObject<(HTMLLIElement | null)[]>;
  className?: string;
}) {
  const testCaseById = useMemo(
    () => new Map(definition.testCases.map((testCase) => [testCase.id, testCase])),
    [definition.testCases],
  );

  const prevBugIndexRef = useRef(bugIndex);
  const [barPhase, setBarPhase] = useState<Record<number, "enter" | "exit">>({});

  useEffect(() => {
    const prev = prevBugIndexRef.current;
    if (prev === bugIndex) return;

    const nextPhase: Record<number, "enter" | "exit"> = {};
    if (prev >= 0) nextPhase[prev] = "exit";
    if (bugIndex >= 0) nextPhase[bugIndex] = "enter";
    setBarPhase(nextPhase);

    const timer = window.setTimeout(() => setBarPhase({}), TASK_BAR_ANIM_MS);
    prevBugIndexRef.current = bugIndex;
    return () => window.clearTimeout(timer);
  }, [bugIndex]);

  return (
    <aside
      className={cn("flex flex-col overflow-hidden rounded-xl border bg-muted/30", className)}
      aria-label="バグ一覧"
    >
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
          key={`${openCount}-${targets.length}`}
          className="mt-2 animate-in fade-in duration-200 text-xs font-semibold text-muted-foreground tabular-nums"
        >
          <span className="text-foreground">{openCount}</span> / {targets.length} 未解決
        </p>
      </div>

      <ScrollArea className="min-h-0 flex-1">
        <ul ref={listRef} className="py-1">
          {targets.length === 0 ? (
            <li className="px-3.5 py-4 text-sm text-muted-foreground">対象バグがありません</li>
          ) : (
            targets.map((bug, index) => {
              const isActive = bugIndex === index && bugIndex >= 0;
              const phase = barPhase[index];
              const showBar = isActive || phase === "exit";
              const relatedTestCase = bug.testCaseId ? testCaseById.get(bug.testCaseId) : undefined;
              const isOpen = !isBugClosed(bug.status);

              return (
                <li
                  key={bug.id}
                  ref={(el) => {
                    itemRefs.current[index] = el;
                  }}
                  className={cn(
                    "relative transition-[background-color] duration-500 ease-in-out motion-reduce:transition-none",
                    isActive && "bg-primary/5",
                    isOpen && !isActive && "bg-red-50/40",
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
                      className={cn(
                        "w-4 shrink-0 text-center text-xs font-bold",
                        statusClass(bug.status),
                      )}
                    >
                      {statusSymbol(bug.status)}
                    </span>
                    <span className="min-w-0">
                      <span className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
                        <span className="text-[0.72rem] font-bold text-primary">{bug.id}</span>
                        <span className="text-[0.68rem] text-muted-foreground">
                          {BUG_STATUS_LABELS[bug.status]} · {BUG_SEVERITY_LABELS[bug.severity]}
                        </span>
                      </span>
                      <span className="mt-0.5 line-clamp-2 text-xs leading-relaxed font-medium text-foreground/90">
                        {bug.title}
                      </span>
                      {relatedTestCase && (
                        <span className="mt-0.5 block text-[0.68rem] text-muted-foreground">
                          {relatedTestCase.id}
                        </span>
                      )}
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

export function BugTaskList() {
  const { definition, results, session } = useApp();
  const { runnerFilters, bugId, setBugId, bugFilters } = useRunnerQueryState();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [descriptionExpanded, setDescriptionExpanded] = useState(false);
  const listRef = useRef<HTMLUListElement>(null);
  const itemRefs = useRef<(HTMLLIElement | null)[]>([]);

  const allEnvIds = useMemo(
    () => (definition ? getAllEnvironmentIds(definition) : []),
    [definition],
  );

  const targets = useMemo(() => {
    if (!definition || !results) return [];
    return resolveFilteredBugs(
      definition,
      runnerFilters,
      results.bugs,
      results.results,
      allEnvIds,
      session,
      bugFilters,
    );
  }, [allEnvIds, bugFilters, definition, results, runnerFilters, session]);

  const bugIndex = useMemo(() => {
    if (!bugId) return -1;
    const index = targets.findIndex((bug) => bug.id === bugId);
    return index >= 0 ? index : -1;
  }, [targets, bugId]);

  const openCount = useMemo(
    () => targets.filter((bug) => !isBugClosed(bug.status)).length,
    [targets],
  );

  const mode = getRunnerTargetMode(runnerFilters);
  const scenario =
    mode === "scenario"
      ? definition?.scenarios?.find((entry) => entry.id === runnerFilters.scenarioId)
      : undefined;

  useEffect(() => {
    itemRefs.current[bugIndex]?.scrollIntoView({ block: "nearest", behavior: "smooth" });
  }, [bugIndex, targets.length]);

  if (!definition || !results) return null;

  const jumpToBug = (index: number) => {
    const bug = targets[index];
    if (bug) void setBugId(bug.id);
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
    openCount,
    targets,
    definition,
    bugIndex,
    onJump: jumpToBug,
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
        バグ一覧 ({targets.length})
      </Button>

      <BugListPanel {...panelProps} className="hidden h-full min-h-0 w-84 shrink-0 md:flex" />

      <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
        <SheetContent side="left" className="w-[min(100vw-1.5rem,22rem)] p-0">
          <SheetHeader className="sr-only">
            <SheetTitle>バグ一覧</SheetTitle>
          </SheetHeader>
          <BugListPanel {...panelProps} className="h-full border-0 rounded-none bg-background" />
        </SheetContent>
      </Sheet>
    </>
  );
}

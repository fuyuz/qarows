import { useEffect, useMemo, useRef, useState } from "react";
import { Plus } from "lucide-react";
import { cn } from "../../lib/cn";
import { formatUpdatedAtShort } from "../../lib/format-updated-at";
import { Badge } from "../ui/badge";
import { ScrollArea } from "../ui/scroll-area";
import { type ProjectListItem, sortProjectListItems } from "./project-list-item";

const TASK_BAR_ANIM_MS = 320;

export interface ProjectListPanelProps {
  summaries: ProjectListItem[];
  selectedId: string | null;
  lastOpenedProjectId: string | null;
  newProjectSelectionId: string;
  onSelect: (projectId: string) => void;
  showSessionBadge?: boolean;
  className?: string;
}

export function ProjectListPanel({
  summaries,
  selectedId,
  lastOpenedProjectId,
  newProjectSelectionId,
  onSelect,
  showSessionBadge = true,
  className,
}: ProjectListPanelProps) {
  const sortedSummaries = useMemo(() => sortProjectListItems(summaries), [summaries]);
  const activeIndex = useMemo(() => {
    if (selectedId === newProjectSelectionId) return -1;
    if (!selectedId) return -1;
    return sortedSummaries.findIndex((summary) => summary.id === selectedId);
  }, [newProjectSelectionId, selectedId, sortedSummaries]);

  const prevActiveIndexRef = useRef(activeIndex);
  const [barPhase, setBarPhase] = useState<Record<number, "enter" | "exit">>({});
  const listRef = useRef<HTMLUListElement>(null);
  const itemRefs = useRef<(HTMLLIElement | null)[]>([]);
  const isNewSelected = selectedId === newProjectSelectionId;

  useEffect(() => {
    const prev = prevActiveIndexRef.current;
    if (prev === activeIndex) return;

    const nextPhase: Record<number, "enter" | "exit"> = {};
    if (prev >= 0) nextPhase[prev] = "exit";
    if (activeIndex >= 0) nextPhase[activeIndex] = "enter";
    setBarPhase(nextPhase);

    const timer = window.setTimeout(() => setBarPhase({}), TASK_BAR_ANIM_MS);
    prevActiveIndexRef.current = activeIndex;
    return () => window.clearTimeout(timer);
  }, [activeIndex]);

  useEffect(() => {
    if (activeIndex >= 0) {
      itemRefs.current[activeIndex]?.scrollIntoView({ block: "nearest", behavior: "smooth" });
    }
  }, [activeIndex, sortedSummaries.length]);

  return (
    <aside
      className={cn("flex flex-col overflow-hidden rounded-xl border bg-muted/30", className)}
      aria-label="プロジェクト一覧"
    >
      <div className="shrink-0 border-b bg-card px-3.5 py-3">
        <h2 className="text-sm font-bold leading-snug">プロジェクト</h2>
        <p className="mt-2 text-xs font-semibold text-muted-foreground tabular-nums">
          {summaries.length} 件登録済み
        </p>
      </div>

      <ScrollArea className="min-h-0 flex-1">
        <ul ref={listRef} className="py-1">
          <li
            className={cn(
              "relative transition-[background-color] duration-500 ease-in-out motion-reduce:transition-none",
              isNewSelected && "bg-primary/5",
            )}
          >
            {isNewSelected && (
              <span
                aria-hidden
                className="pointer-events-none absolute inset-y-0 left-0 z-10 w-[3px] rounded-r bg-primary animate-task-bar-enter"
              />
            )}
            <button
              type="button"
              className="relative z-[1] flex w-full items-start gap-2 px-3 py-2.5 text-left hover:bg-muted/50"
              onClick={() => onSelect(newProjectSelectionId)}
            >
              <Plus className="mt-0.5 size-4 shrink-0 text-primary" aria-hidden />
              <span className="min-w-0">
                <span className="text-xs font-bold text-foreground">新規作成</span>
                <span className="mt-0.5 block text-[0.68rem] leading-relaxed text-muted-foreground">
                  tests.yml を追加
                </span>
              </span>
            </button>
          </li>

          {sortedSummaries.map((summary, index) => {
            const isActive = activeIndex === index && activeIndex >= 0;
            const phase = barPhase[index];
            const showBar = isActive || phase === "exit";
            const isLastOpened = summary.id === lastOpenedProjectId;

            return (
              <li
                key={summary.id}
                ref={(el) => {
                  itemRefs.current[index] = el;
                }}
                className={cn(
                  "relative transition-[background-color] duration-500 ease-in-out motion-reduce:transition-none",
                  isActive && "bg-primary/5",
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
                  onClick={() => onSelect(summary.id)}
                >
                  <span className="min-w-0 flex-1">
                    <span className="line-clamp-2 text-xs font-bold leading-snug text-foreground">
                      {summary.name}
                    </span>
                    <span className="mt-0.5 block font-mono text-[0.65rem] text-muted-foreground">
                      {summary.id}
                    </span>
                    <span className="mt-1 flex flex-wrap gap-1">
                      {showSessionBadge && summary.hasValidSession && (
                        <Badge className="h-4 px-1.5 text-[0.6rem]">セッション</Badge>
                      )}
                      {isLastOpened && (
                        <Badge variant="secondary" className="h-4 px-1.5 text-[0.6rem]">
                          前回
                        </Badge>
                      )}
                    </span>
                    <span className="mt-1 block text-[0.65rem] text-muted-foreground">
                      {formatUpdatedAtShort(summary.updatedAt)}
                    </span>
                  </span>
                </button>
              </li>
            );
          })}
        </ul>
      </ScrollArea>
    </aside>
  );
}

import { useLayoutEffect, useMemo, useRef, useState, type MouseEvent } from "react";
import { Plus } from "lucide-react";
import { cn } from "../../lib/cn";
import { formatUpdatedAtShort } from "../../lib/format-updated-at";
import { useTranslation } from "../../i18n/context";
import { Badge } from "../ui/badge";
import { ScrollArea } from "../ui/scroll-area";
import { type ProjectListItem, sortProjectListItems } from "./project-list-item";

const TASK_BAR_ANIM_MS = 320;
/** 「新規作成」行。プロジェクト index (>=0) と区別する */
const NEW_ROW_INDEX = -1;
/** 未選択 */
const NONE_INDEX = -2;

function focusListButton(event: MouseEvent<HTMLButtonElement>) {
  event.preventDefault();
  event.currentTarget.focus({ preventScroll: true });
}

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
  const { t, localeTag } = useTranslation();
  const sortedSummaries = useMemo(() => sortProjectListItems(summaries), [summaries]);
  const activeIndex = useMemo(() => {
    if (selectedId === newProjectSelectionId) return NEW_ROW_INDEX;
    if (!selectedId) return NONE_INDEX;
    const index = sortedSummaries.findIndex((summary) => summary.id === selectedId);
    return index >= 0 ? index : NONE_INDEX;
  }, [newProjectSelectionId, selectedId, sortedSummaries]);

  const prevActiveIndexRef = useRef(activeIndex);
  const [barPhase, setBarPhase] = useState<Record<number, "enter" | "exit">>({});
  const itemRefs = useRef<(HTMLLIElement | null)[]>([]);
  const newRowRef = useRef<HTMLLIElement | null>(null);
  const isNewSelected = activeIndex === NEW_ROW_INDEX;

  useLayoutEffect(() => {
    const prev = prevActiveIndexRef.current;
    if (prev !== activeIndex) {
      const nextPhase: Record<number, "enter" | "exit"> = {};
      if (prev === NEW_ROW_INDEX || prev >= 0) nextPhase[prev] = "exit";
      if (activeIndex === NEW_ROW_INDEX || activeIndex >= 0) nextPhase[activeIndex] = "enter";
      setBarPhase(nextPhase);
      prevActiveIndexRef.current = activeIndex;

      const timer = window.setTimeout(() => setBarPhase({}), TASK_BAR_ANIM_MS);
      if (activeIndex === NEW_ROW_INDEX) {
        newRowRef.current?.scrollIntoView({ block: "nearest", behavior: "auto" });
      } else if (activeIndex >= 0) {
        itemRefs.current[activeIndex]?.scrollIntoView({ block: "nearest", behavior: "auto" });
      }
      return () => window.clearTimeout(timer);
    }

    if (activeIndex === NEW_ROW_INDEX) {
      newRowRef.current?.scrollIntoView({ block: "nearest", behavior: "auto" });
    } else if (activeIndex >= 0) {
      itemRefs.current[activeIndex]?.scrollIntoView({ block: "nearest", behavior: "auto" });
    }
  }, [activeIndex, sortedSummaries.length]);

  const newPhase = barPhase[NEW_ROW_INDEX];
  const showNewBar = isNewSelected || newPhase === "exit";

  return (
    <aside
      className={cn("flex flex-col overflow-hidden rounded-xl border bg-muted/30", className)}
      aria-label={t("project.listAria")}
    >
      <div className="shrink-0 border-b bg-card px-3.5 py-3">
        <h2 className="text-sm font-bold leading-snug">{t("project.title")}</h2>
        <p className="mt-2 text-xs font-semibold text-muted-foreground tabular-nums">
          {t("common.countRegistered", { n: summaries.length })}
        </p>
      </div>

      <ScrollArea className="min-h-0 flex-1">
        <ul className="py-1">
          <li
            ref={newRowRef}
            className={cn(
              "relative transition-[background-color] duration-500 ease-in-out motion-reduce:transition-none",
              isNewSelected && "bg-primary/5",
            )}
          >
            {showNewBar && (
              <span
                aria-hidden
                className={cn(
                  "pointer-events-none absolute inset-y-0 left-0 z-10 w-[3px] rounded-r bg-primary",
                  newPhase === "exit" && "animate-task-bar-exit",
                  newPhase === "enter" && "animate-task-bar-enter",
                )}
              />
            )}
            <button
              type="button"
              className="relative z-[1] flex w-full items-start gap-2 px-3 py-2.5 text-left hover:bg-muted/50"
              onMouseDown={focusListButton}
              onClick={() => onSelect(newProjectSelectionId)}
            >
              <Plus className="mt-0.5 size-4 shrink-0 text-primary" aria-hidden />
              <span className="min-w-0">
                <span className="text-xs font-bold text-foreground">{t("project.new")}</span>
                <span className="mt-0.5 block text-[0.68rem] leading-relaxed text-muted-foreground">
                  {t("project.addYaml")}
                </span>
              </span>
            </button>
          </li>

          {sortedSummaries.map((summary, index) => {
            const isActive = activeIndex === index;
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
                  onMouseDown={focusListButton}
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
                        <Badge className="h-4 px-1.5 text-[0.6rem]">{t("project.badgeSession")}</Badge>
                      )}
                      {isLastOpened && (
                        <Badge variant="secondary" className="h-4 px-1.5 text-[0.6rem]">
                          {t("project.badgeLastOpened")}
                        </Badge>
                      )}
                    </span>
                    <span className="mt-1 block text-[0.65rem] text-muted-foreground">
                      {formatUpdatedAtShort(summary.updatedAt, localeTag)}
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

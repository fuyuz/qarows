import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { ListFilterIcon } from "lucide-react";
import { BUG_SEVERITY_LABELS, BUG_STATUS_LABELS, getRunnerTargetMode, type BugSeverity, type BugStatus } from "@qarows/shared";
import { useApp } from "@/context/AppContext";
import { useRunnerQueryState } from "@/hooks/useRunnerQueryState";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/cn";
import { RunnerCardTransition } from "@/components/RunnerCardTransition";
import { BUG_SEVERITY_VALUES, BUG_STATUS_VALUES, type BugFilters } from "@/lib/bug-query";
import {
  getMajorCategories,
  getMediumCategories,
  getMinorCategories,
} from "@/lib/utils";

const ALL = "__all__";

type RunnerMode = "filter" | "scenario";

const modeSwitchButtonClass = cn(
  "relative z-10 h-8 rounded-md px-3 text-sm font-semibold transition-[color,transform] duration-200 ease-out motion-reduce:transition-none",
  "active:scale-[0.97] active:duration-100",
);

function RunnerModeSwitch({
  value,
  onFilter,
  onScenario,
  hasScenarios,
}: {
  value: RunnerMode;
  onFilter: () => void;
  onScenario: () => void;
  hasScenarios: boolean;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const filterRef = useRef<HTMLButtonElement>(null);
  const scenarioRef = useRef<HTMLButtonElement>(null);
  const [indicator, setIndicator] = useState<{ left: number; width: number } | null>(null);

  const syncIndicator = useCallback(() => {
    const activeRef = value === "filter" ? filterRef : scenarioRef;
    const active = activeRef.current;
    if (!active) return;
    setIndicator({
      left: active.offsetLeft,
      width: active.offsetWidth,
    });
  }, [value]);

  useLayoutEffect(() => {
    syncIndicator();
  }, [syncIndicator]);

  useEffect(() => {
    const container = containerRef.current;
    if (!container || typeof ResizeObserver === "undefined") return;
    const observer = new ResizeObserver(() => syncIndicator());
    observer.observe(container);
    return () => observer.disconnect();
  }, [syncIndicator]);

  return (
    <div
      ref={containerRef}
      role="group"
      aria-label="対象の選び方"
      className="relative inline-flex gap-1 rounded-lg border border-input bg-muted/80 p-1 shadow-xs"
    >
      {indicator && (
        <span
          aria-hidden
          className="pointer-events-none absolute top-1 bottom-1 rounded-md bg-primary shadow-sm transition-[left,width] duration-200 ease-out motion-reduce:transition-none"
          style={{
            left: indicator.left,
            width: indicator.width,
          }}
        />
      )}
      <button
        ref={filterRef}
        type="button"
        aria-pressed={value === "filter"}
        onClick={onFilter}
        className={cn(
          modeSwitchButtonClass,
          value === "filter"
            ? "text-primary-foreground"
            : "text-muted-foreground hover:text-foreground",
        )}
      >
        フィルタ
      </button>
      <button
        ref={scenarioRef}
        type="button"
        aria-pressed={value === "scenario"}
        disabled={!hasScenarios}
        title={hasScenarios ? undefined : "tests.yml に scenarios がありません"}
        onClick={onScenario}
        className={cn(
          modeSwitchButtonClass,
          value === "scenario"
            ? "text-primary-foreground"
            : "text-muted-foreground hover:text-foreground",
        )}
      >
        シナリオ
      </button>
    </div>
  );
}

function BugFilterCheckGroup<T extends string>({
  label,
  options,
  labels,
  selected,
  onToggle,
}: {
  label: string;
  options: readonly T[];
  labels: Record<T, string>;
  selected: readonly T[];
  onToggle: (value: T) => void;
}) {
  return (
    <div className="space-y-2.5">
      <Label className="text-sm font-semibold">{label}</Label>
      <div className="flex flex-wrap gap-x-4 gap-y-2">
        {options.map((value) => {
          const checked = selected.includes(value);
          return (
            <label
              key={value}
              className={cn(
                "flex cursor-pointer items-center gap-2 rounded-md px-1 py-0.5 text-sm font-medium whitespace-nowrap transition-colors duration-200",
                checked && "bg-primary/10 text-primary",
              )}
            >
              <Checkbox checked={checked} onCheckedChange={() => onToggle(value)} />
              <span>{labels[value]}</span>
            </label>
          );
        })}
      </div>
    </div>
  );
}

function BugFilterDialog({
  bugFilters,
  toggleBugPriority,
  toggleBugStatus,
  onClear,
}: {
  bugFilters: BugFilters;
  toggleBugPriority: (value: BugSeverity) => void;
  toggleBugStatus: (value: BugStatus) => void;
  onClear: () => void;
}) {
  const active = bugFilters.priorities.length > 0 || bugFilters.statuses.length > 0;
  const activeCount = bugFilters.priorities.length + bugFilters.statuses.length;

  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button
          type="button"
          variant={active ? "default" : "outline"}
          size="icon-sm"
          aria-label="バグを絞り込み"
          aria-pressed={active}
          className={cn("relative shadow-xs", active && "hover:bg-primary/90")}
        >
          <ListFilterIcon className="size-4" aria-hidden />
          {active && (
            <span className="absolute -top-1 -right-1 flex size-4 items-center justify-center rounded-full border border-primary bg-background text-[10px] font-bold text-primary shadow-sm">
              {activeCount}
            </span>
          )}
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>バグの絞り込み</DialogTitle>
          <DialogDescription>
            重要度・ステータスを複数選択できます。未選択の項目はすべて表示されます。
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-5">
          <BugFilterCheckGroup
            label="重要度"
            options={BUG_SEVERITY_VALUES}
            labels={BUG_SEVERITY_LABELS}
            selected={bugFilters.priorities}
            onToggle={toggleBugPriority}
          />
          <BugFilterCheckGroup
            label="ステータス"
            options={BUG_STATUS_VALUES}
            labels={BUG_STATUS_LABELS}
            selected={bugFilters.statuses}
            onToggle={toggleBugStatus}
          />
        </div>
        <DialogFooter>
          <Button type="button" variant="outline" disabled={!active} onClick={onClear}>
            すべてクリア
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export function RunnerFilterBar({
  className,
  maxWidthClass = "max-w-6xl",
  variant = "runner",
}: {
  className?: string;
  maxWidthClass?: string;
  variant?: "runner" | "bugs";
}) {
  const { definition } = useApp();
  const { runnerFilters, setRunnerFilters, bugFilters, toggleBugPriority, toggleBugStatus, setQuery } =
    useRunnerQueryState();

  const mode = getRunnerTargetMode(runnerFilters);
  const scenarios = definition?.scenarios ?? [];
  const hasScenarios = scenarios.length > 0;

  const majorCategories = useMemo(
    () => (definition ? getMajorCategories(definition) : []),
    [definition],
  );

  const mediumCategories = useMemo(
    () =>
      definition ? getMediumCategories(definition, runnerFilters.majorCategoryFilter) : [],
    [definition, runnerFilters.majorCategoryFilter],
  );

  const minorCategories = useMemo(
    () =>
      definition
        ? getMinorCategories(
            definition,
            runnerFilters.majorCategoryFilter,
            runnerFilters.mediumCategoryFilter,
          )
        : [],
    [definition, runnerFilters.majorCategoryFilter, runnerFilters.mediumCategoryFilter],
  );

  if (!definition) return null;

  const keepMinorFilter = (major?: string, medium?: string) => {
    if (!runnerFilters.minorCategoryFilter) return undefined;
    return getMinorCategories(definition, major, medium).includes(runnerFilters.minorCategoryFilter)
      ? runnerFilters.minorCategoryFilter
      : undefined;
  };

  const switchToFilterMode = () => {
    if (mode === "filter") return;
    void setRunnerFilters({
      targetMode: "filter",
      onlyIncomplete: runnerFilters.onlyIncomplete,
      majorCategoryFilter: undefined,
      mediumCategoryFilter: undefined,
      minorCategoryFilter: undefined,
    });
  };

  const switchToScenarioMode = () => {
    if (mode === "scenario" || !hasScenarios) return;
    const scenarioId = scenarios[0]?.id;
    void setRunnerFilters({
      targetMode: "scenario",
      scenarioId,
      onlyIncomplete: runnerFilters.onlyIncomplete,
      majorCategoryFilter: undefined,
      mediumCategoryFilter: undefined,
      minorCategoryFilter: undefined,
    });
  };

  const updateMajorFilter = (value: string) => {
    const major = value === ALL ? undefined : value;
    const nextMedium =
      major && runnerFilters.mediumCategoryFilter
        ? getMediumCategories(definition, major).includes(runnerFilters.mediumCategoryFilter)
          ? runnerFilters.mediumCategoryFilter
          : undefined
        : runnerFilters.mediumCategoryFilter;

    void setRunnerFilters({
      ...runnerFilters,
      targetMode: "filter",
      scenarioId: undefined,
      majorCategoryFilter: major,
      mediumCategoryFilter: nextMedium,
      minorCategoryFilter: keepMinorFilter(major, nextMedium),
    });
  };

  const updateMediumFilter = (value: string) => {
    const medium = value === ALL ? undefined : value;
    void setRunnerFilters({
      ...runnerFilters,
      targetMode: "filter",
      scenarioId: undefined,
      mediumCategoryFilter: medium,
      minorCategoryFilter: keepMinorFilter(runnerFilters.majorCategoryFilter, medium),
    });
  };

  const filterMode = mode === "filter";

  return (
    <div className={cn("border-b bg-card shadow-sm", className)}>
      <div
        className={cn(
          "mx-auto flex flex-col gap-2 px-5 py-2.5 pr-16",
          maxWidthClass,
        )}
      >
        <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
          <RunnerModeSwitch
            value={filterMode ? "filter" : "scenario"}
            onFilter={switchToFilterMode}
            onScenario={switchToScenarioMode}
            hasScenarios={hasScenarios}
          />

          <div className="min-w-0 flex-1">
            <RunnerCardTransition slideKey={filterMode ? "filter" : "scenario"}>
              {filterMode ? (
                <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
                  <div className="flex items-center gap-2">
                    <Label className="shrink-0 text-sm font-semibold">大分類</Label>
                    <Select
                      value={runnerFilters.majorCategoryFilter ?? ALL}
                      onValueChange={updateMajorFilter}
                    >
                      <SelectTrigger className="h-auto min-w-28 px-2.5 py-1.5 text-sm font-semibold">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value={ALL}>すべて</SelectItem>
                        {majorCategories.map((major) => (
                          <SelectItem key={major} value={major}>
                            {major}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="flex items-center gap-2">
                    <Label className="shrink-0 text-sm font-semibold">中分類</Label>
                    <Select
                      value={runnerFilters.mediumCategoryFilter ?? ALL}
                      onValueChange={updateMediumFilter}
                      disabled={mediumCategories.length === 0}
                    >
                      <SelectTrigger className="h-auto min-w-28 px-2.5 py-1.5 text-sm font-semibold">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value={ALL}>すべて</SelectItem>
                        {mediumCategories.map((medium) => (
                          <SelectItem key={medium} value={medium}>
                            {medium}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="flex items-center gap-2">
                    <Label className="shrink-0 text-sm font-semibold">小分類</Label>
                    <Select
                      value={runnerFilters.minorCategoryFilter ?? ALL}
                      onValueChange={(value) =>
                        void setRunnerFilters({
                          ...runnerFilters,
                          targetMode: "filter",
                          scenarioId: undefined,
                          minorCategoryFilter: value === ALL ? undefined : value,
                        })
                      }
                      disabled={minorCategories.length === 0}
                    >
                      <SelectTrigger className="h-auto min-w-28 px-2.5 py-1.5 text-sm font-semibold">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value={ALL}>すべて</SelectItem>
                        {minorCategories.map((minor) => (
                          <SelectItem key={minor} value={minor}>
                            {minor}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              ) : (
                <div className="flex min-w-40 flex-1 items-center gap-2">
                  <Label className="shrink-0 text-sm font-semibold">シナリオ</Label>
                  <Select
                    value={runnerFilters.scenarioId ?? scenarios[0]?.id ?? ""}
                    onValueChange={(value) =>
                      void setRunnerFilters({
                        ...runnerFilters,
                        targetMode: "scenario",
                        scenarioId: value || undefined,
                        majorCategoryFilter: undefined,
                        mediumCategoryFilter: undefined,
                        minorCategoryFilter: undefined,
                      })
                    }
                  >
                    <SelectTrigger className="h-auto min-w-48 max-w-72 flex-1 px-2.5 py-1.5 text-sm font-semibold">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {scenarios.map((scenario) => (
                        <SelectItem key={scenario.id} value={scenario.id}>
                          {scenario.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}
            </RunnerCardTransition>
          </div>

          {variant === "runner" && (
            <label
              className={cn(
                "flex cursor-pointer items-center gap-2 text-sm font-semibold whitespace-nowrap rounded-md px-1 py-0.5 transition-colors duration-200",
                runnerFilters.onlyIncomplete && "bg-primary/10 text-primary",
              )}
            >
              <Checkbox
                checked={runnerFilters.onlyIncomplete}
                onCheckedChange={(checked) =>
                  void setRunnerFilters({
                    ...runnerFilters,
                    onlyIncomplete: checked === true,
                  })
                }
              />
              <span>未実施のみ</span>
            </label>
          )}

          {variant === "bugs" && (
            <BugFilterDialog
              bugFilters={bugFilters}
              toggleBugPriority={toggleBugPriority}
              toggleBugStatus={toggleBugStatus}
              onClear={() => void setQuery({ priority: [], status: [] })}
            />
          )}
        </div>
      </div>
    </div>
  );
}

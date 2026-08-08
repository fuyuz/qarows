import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { ListFilterIcon } from "lucide-react";
import {
  getRunnerTargetMode,
  type BugSeverity,
  type BugStatus,
  type RunnerFilters,
} from "@qarows/shared";
import { useTranslation } from "@qarows/ui";
import { useRunnerWorkspace } from "../context/runner-workspace";
import { useRunnerQueryState } from "../hooks/useRunnerQueryState";
import {
  Button,
  Checkbox,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  Label,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  cn,
} from "@qarows/ui";
import { RunnerCardTransition } from "./RunnerCardTransition";
import { BUG_SEVERITY_VALUES, BUG_STATUS_VALUES, type BugFilters } from "../lib/bug-query";
import { useBugLabels } from "../hooks/useBugLabels";
import {
  getMajorCategories,
  getMediumCategories,
  getMinorCategories,
} from "../lib/runner-utils";

const ALL = "__all__";

type RunnerMode = "filter" | "scenario";

const RUNNER_SCOPE_FILTER_OPTIONS = [
  { key: "onlyIncomplete", labelKey: "runner.incompleteOnly" },
  { key: "onlyWithBugs", labelKey: "runner.withBugs" },
  { key: "onlyWithNg", labelKey: "runner.withNg" },
] as const satisfies ReadonlyArray<{
  key: keyof Pick<RunnerFilters, "onlyIncomplete" | "onlyWithBugs" | "onlyWithNg">;
  labelKey: string;
}>;

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
  const { t } = useTranslation();
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

  const modeOptions = [
    { mode: "filter", label: t("runner.filter"), ref: filterRef, onClick: onFilter, disabled: false, title: undefined },
    {
      mode: "scenario",
      label: t("runner.scenario"),
      ref: scenarioRef,
      onClick: onScenario,
      disabled: !hasScenarios,
      title: hasScenarios ? undefined : t("runner.noScenarios"),
    },
  ] as const;

  return (
    <div
      ref={containerRef}
      role="group"
      aria-label={t("runner.targetModeAria")}
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
      {modeOptions.map((option) => (
        <button
          key={option.mode}
          ref={option.ref}
          type="button"
          aria-pressed={value === option.mode}
          disabled={option.disabled}
          title={option.title}
          onClick={option.onClick}
          className={cn(
            modeSwitchButtonClass,
            value === option.mode
              ? "text-primary-foreground"
              : "text-muted-foreground hover:text-foreground",
          )}
        >
          {option.label}
        </button>
      ))}
    </div>
  );
}

function FilterCheckItem({
  checked,
  onCheckedChange,
  children,
}: {
  checked: boolean;
  onCheckedChange: (checked: boolean) => void;
  children: ReactNode;
}) {
  return (
    <label
      className={cn(
        "flex cursor-pointer items-center gap-2 rounded-md px-1 py-0.5 text-sm font-medium whitespace-nowrap transition-colors duration-200",
        checked && "bg-primary/10 text-primary",
      )}
    >
      <Checkbox checked={checked} onCheckedChange={(value) => onCheckedChange(value === true)} />
      <span>{children}</span>
    </label>
  );
}

function FilterCheckGroup<T extends string>({
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
        {options.map((value) => (
          <FilterCheckItem
            key={value}
            checked={selected.includes(value)}
            onCheckedChange={() => onToggle(value)}
          >
            {labels[value]}
          </FilterCheckItem>
        ))}
      </div>
    </div>
  );
}

function FilterDialogTriggerButton({
  ariaLabel,
  activeCount,
}: {
  ariaLabel: string;
  activeCount: number;
}) {
  const active = activeCount > 0;
  return (
    <DialogTrigger asChild>
      <Button
        type="button"
        variant={active ? "default" : "outline"}
        size="icon-sm"
        aria-label={ariaLabel}
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
  );
}

function RunnerScopeFilterDialog({
  runnerFilters,
  setRunnerFilters,
}: {
  runnerFilters: RunnerFilters;
  setRunnerFilters: (filters: RunnerFilters) => void;
}) {
  const { t } = useTranslation();
  const activeCount = RUNNER_SCOPE_FILTER_OPTIONS.filter(({ key }) => runnerFilters[key]).length;
  const active = activeCount > 0;

  const toggleScopeFilter = (
    key: (typeof RUNNER_SCOPE_FILTER_OPTIONS)[number]["key"],
    checked: boolean,
  ) => {
    void setRunnerFilters({
      ...runnerFilters,
      [key]: checked,
    });
  };

  const clearScopeFilters = () => {
    void setRunnerFilters({
      ...runnerFilters,
      onlyIncomplete: false,
      onlyWithBugs: false,
      onlyWithNg: false,
    });
  };

  return (
    <Dialog>
      <FilterDialogTriggerButton ariaLabel={t("runner.filterTestsAria")} activeCount={activeCount} />
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{t("runner.filterTests")}</DialogTitle>
          <DialogDescription>{t("runner.filterHint")}</DialogDescription>
        </DialogHeader>
        <div className="space-y-2.5">
          {RUNNER_SCOPE_FILTER_OPTIONS.map(({ key, labelKey }) => (
            <FilterCheckItem
              key={key}
              checked={runnerFilters[key]}
              onCheckedChange={(checked) => toggleScopeFilter(key, checked)}
            >
              {t(labelKey)}
            </FilterCheckItem>
          ))}
        </div>
        <DialogFooter>
          <Button type="button" variant="outline" disabled={!active} onClick={clearScopeFilters}>
            {t("runner.clearAll")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
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
  const { t } = useTranslation();
  const { statusLabels, severityLabels } = useBugLabels();
  const active = bugFilters.priorities.length > 0 || bugFilters.statuses.length > 0;
  const activeCount = bugFilters.priorities.length + bugFilters.statuses.length;

  return (
    <Dialog>
      <FilterDialogTriggerButton ariaLabel={t("runner.filterBugsAria")} activeCount={activeCount} />
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{t("runner.filterBugs")}</DialogTitle>
          <DialogDescription>{t("runner.bugFilterHint")}</DialogDescription>
        </DialogHeader>
        <div className="space-y-5">
          <FilterCheckGroup
            label={t("runner.severity")}
            options={BUG_SEVERITY_VALUES}
            labels={severityLabels}
            selected={bugFilters.priorities}
            onToggle={toggleBugPriority}
          />
          <FilterCheckGroup
            label={t("runner.status")}
            options={BUG_STATUS_VALUES}
            labels={statusLabels}
            selected={bugFilters.statuses}
            onToggle={toggleBugStatus}
          />
        </div>
        <DialogFooter>
          <Button type="button" variant="outline" disabled={!active} onClick={onClear}>
            {t("runner.clearAll")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function CategorySelect({
  label,
  value,
  options,
  onValueChange,
  disabled,
}: {
  label: string;
  value: string | undefined;
  options: string[];
  onValueChange: (value: string) => void;
  disabled?: boolean;
}) {
  return (
    <div className="flex items-center gap-2">
      <Label className="shrink-0 text-sm font-semibold">{label}</Label>
      <Select value={value ?? ALL} onValueChange={onValueChange} disabled={disabled}>
        <SelectTrigger className="h-auto min-w-28 px-2.5 py-1.5 text-sm font-semibold">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value={ALL}>{t("common.all")}</SelectItem>
          {options.map((option) => (
            <SelectItem key={option} value={option}>
              {option}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
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
  const { t, locale } = useTranslation();
  const { definition } = useRunnerWorkspace();
  const { runnerFilters, setRunnerFilters, bugFilters, toggleBugPriority, toggleBugStatus, setQuery } =
    useRunnerQueryState();

  const mode = getRunnerTargetMode(runnerFilters);
  const scenarios = definition?.scenarios ?? [];
  const hasScenarios = scenarios.length > 0;

  const majorCategories = useMemo(
    () => (definition ? getMajorCategories(definition, locale) : []),
    [definition, locale],
  );

  const mediumCategories = useMemo(
    () =>
      definition ? getMediumCategories(definition, runnerFilters.majorCategoryFilter, locale) : [],
    [definition, locale, runnerFilters.majorCategoryFilter],
  );

  const minorCategories = useMemo(
    () =>
      definition
        ? getMinorCategories(
            definition,
            runnerFilters.majorCategoryFilter,
            runnerFilters.mediumCategoryFilter,
            locale,
          )
        : [],
    [definition, locale, runnerFilters.majorCategoryFilter, runnerFilters.mediumCategoryFilter],
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
      onlyWithBugs: runnerFilters.onlyWithBugs,
      onlyWithNg: runnerFilters.onlyWithNg,
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
      onlyWithBugs: runnerFilters.onlyWithBugs,
      onlyWithNg: runnerFilters.onlyWithNg,
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

  const updateMinorFilter = (value: string) => {
    void setRunnerFilters({
      ...runnerFilters,
      targetMode: "filter",
      scenarioId: undefined,
      minorCategoryFilter: value === ALL ? undefined : value,
    });
  };

  const filterMode = mode === "filter";

  return (
    <div className={cn("border-b bg-card shadow-sm", className)}>
      <div
        className={cn(
          "mx-auto flex flex-col gap-2 px-5 py-2.5 pr-24",
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
                  <CategorySelect
                    label={t("runner.major")}
                    value={runnerFilters.majorCategoryFilter}
                    options={majorCategories}
                    onValueChange={updateMajorFilter}
                  />
                  <CategorySelect
                    label={t("runner.medium")}
                    value={runnerFilters.mediumCategoryFilter}
                    options={mediumCategories}
                    onValueChange={updateMediumFilter}
                    disabled={mediumCategories.length === 0}
                  />
                  <CategorySelect
                    label={t("runner.minor")}
                    value={runnerFilters.minorCategoryFilter}
                    options={minorCategories}
                    onValueChange={updateMinorFilter}
                    disabled={minorCategories.length === 0}
                  />
                </div>
              ) : (
                <div className="flex min-w-40 flex-1 items-center gap-2">
                  <Label className="shrink-0 text-sm font-semibold">{t("runner.scenario")}</Label>
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
            <RunnerScopeFilterDialog
              runnerFilters={runnerFilters}
              setRunnerFilters={setRunnerFilters}
            />
          )}

          {variant === "bugs" && (
            <BugFilterDialog
              bugFilters={bugFilters}
              toggleBugPriority={toggleBugPriority}
              toggleBugStatus={toggleBugStatus}
              onClear={() => void setQuery({ bugFilters: [] })}
            />
          )}
        </div>
      </div>
    </div>
  );
}

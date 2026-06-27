import { useMemo } from "react";
import { getRunnerTargetMode } from "@qarows/shared";
import { useApp } from "@/context/AppContext";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import {
  getMajorCategories,
  getMediumCategories,
  getMinorCategories,
  resolveRunnerTestCases,
} from "@/lib/utils";

const ALL = "__all__";

export function FilterBar() {
  const { definition, results, session, runnerFilters, setRunnerFilters } = useApp();

  const mode = getRunnerTargetMode(runnerFilters);
  const scenarios = definition?.scenarios ?? [];
  const hasScenarios = scenarios.length > 0;

  const majorCategories = useMemo(
    () => (definition ? getMajorCategories(definition) : []),
    [definition],
  );

  const mediumCategories = useMemo(
    () =>
      definition
        ? getMediumCategories(definition, runnerFilters.majorCategoryFilter)
        : [],
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

  const targetCount = useMemo(() => {
    if (!definition || !results || !session) return null;
    return resolveRunnerTestCases(definition, session, runnerFilters, results.results).length;
  }, [definition, results, session, runnerFilters]);

  if (!definition || !session) return null;

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
    <div className="sticky top-0 z-10 border-b bg-card shadow-sm">
      <div className="mx-auto flex max-w-6xl flex-wrap items-center gap-x-4 gap-y-2 px-5 py-2.5 pr-16">
        <ToggleGroup
          type="single"
          value={filterMode ? "filter" : "scenario"}
          onValueChange={(value) => {
            if (value === "filter") switchToFilterMode();
            if (value === "scenario") switchToScenarioMode();
          }}
          aria-label="対象の選び方"
        >
          <ToggleGroupItem value="filter" className="px-3 text-sm font-semibold">
            フィルタ
          </ToggleGroupItem>
          <ToggleGroupItem
            value="scenario"
            disabled={!hasScenarios}
            title={hasScenarios ? undefined : "tests.yml に scenarios がありません"}
            className="px-3 text-sm font-semibold"
          >
            シナリオ
          </ToggleGroupItem>
        </ToggleGroup>

        {filterMode ? (
          <>
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
          </>
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

        <label className="flex cursor-pointer items-center gap-2 text-sm font-semibold whitespace-nowrap">
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

        {targetCount !== null && (
          <span className="ml-auto text-sm font-semibold text-primary">{targetCount} 件</span>
        )}
      </div>
    </div>
  );
}

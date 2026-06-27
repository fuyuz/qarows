import { useMemo } from "react";
import { getRunnerTargetMode } from "@qarows/shared";
import { useApp } from "@/context/AppContext";
import {
  getMajorCategories,
  getMediumCategories,
  getMinorCategories,
  resolveRunnerTestCases,
} from "@/lib/utils";

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

  const updateMajorFilter = (major: string | undefined) => {
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

  const updateMediumFilter = (medium: string | undefined) => {
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
    <div className="filter-bar">
      <div className="filter-bar__inner">
        <div className="filter-bar__mode" role="group" aria-label="対象の選び方">
          <button
            type="button"
            className={`filter-bar__mode-btn${filterMode ? " filter-bar__mode-btn--active" : ""}`}
            aria-pressed={filterMode}
            onClick={switchToFilterMode}
          >
            フィルタ
          </button>
          <button
            type="button"
            className={`filter-bar__mode-btn${!filterMode ? " filter-bar__mode-btn--active" : ""}`}
            aria-pressed={!filterMode}
            disabled={!hasScenarios}
            title={hasScenarios ? undefined : "tests.yml に scenarios がありません"}
            onClick={switchToScenarioMode}
          >
            シナリオ
          </button>
        </div>

        {filterMode ? (
          <>
            <label className="filter-bar__field">
              <span className="filter-bar__label">大分類</span>
              <select
                className="filter-bar__select"
                value={runnerFilters.majorCategoryFilter ?? ""}
                onChange={(e) => updateMajorFilter(e.target.value || undefined)}
              >
                <option value="">すべて</option>
                {majorCategories.map((major) => (
                  <option key={major} value={major}>
                    {major}
                  </option>
                ))}
              </select>
            </label>

            <label className="filter-bar__field">
              <span className="filter-bar__label">中分類</span>
              <select
                className="filter-bar__select"
                value={runnerFilters.mediumCategoryFilter ?? ""}
                disabled={mediumCategories.length === 0}
                onChange={(e) => updateMediumFilter(e.target.value || undefined)}
              >
                <option value="">すべて</option>
                {mediumCategories.map((medium) => (
                  <option key={medium} value={medium}>
                    {medium}
                  </option>
                ))}
              </select>
            </label>

            <label className="filter-bar__field">
              <span className="filter-bar__label">小分類</span>
              <select
                className="filter-bar__select"
                value={runnerFilters.minorCategoryFilter ?? ""}
                disabled={minorCategories.length === 0}
                onChange={(e) =>
                  void setRunnerFilters({
                    ...runnerFilters,
                    targetMode: "filter",
                    scenarioId: undefined,
                    minorCategoryFilter: e.target.value || undefined,
                  })
                }
              >
                <option value="">すべて</option>
                {minorCategories.map((minor) => (
                  <option key={minor} value={minor}>
                    {minor}
                  </option>
                ))}
              </select>
            </label>
          </>
        ) : (
          <label className="filter-bar__field filter-bar__field--grow">
            <span className="filter-bar__label">シナリオ</span>
            <select
              className="filter-bar__select filter-bar__select--wide"
              value={runnerFilters.scenarioId ?? ""}
              onChange={(e) =>
                void setRunnerFilters({
                  ...runnerFilters,
                  targetMode: "scenario",
                  scenarioId: e.target.value || undefined,
                  majorCategoryFilter: undefined,
                  mediumCategoryFilter: undefined,
                  minorCategoryFilter: undefined,
                })
              }
            >
              {scenarios.map((scenario) => (
                <option key={scenario.id} value={scenario.id}>
                  {scenario.name}
                </option>
              ))}
            </select>
          </label>
        )}

        <label className="filter-bar__toggle">
          <input
            type="checkbox"
            checked={runnerFilters.onlyIncomplete}
            onChange={(e) =>
              void setRunnerFilters({
                ...runnerFilters,
                onlyIncomplete: e.target.checked,
              })
            }
          />
          <span>未実施のみ</span>
        </label>

        {targetCount !== null && (
          <span className="filter-bar__count">{targetCount} 件</span>
        )}
      </div>
    </div>
  );
}

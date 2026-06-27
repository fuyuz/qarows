import { useMemo } from "react";
import { useApp } from "@/context/AppContext";
import { filterTestCases, getMajorCategories, getMediumCategories } from "@/lib/utils";

export function FilterBar() {
  const { definition, results, session, runnerFilters, setRunnerFilters } = useApp();

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

  const targetCount = useMemo(() => {
    if (!definition || !results || !session) return null;
    return filterTestCases(definition, session, runnerFilters, results.results).length;
  }, [definition, results, session, runnerFilters]);

  if (!definition || !session) return null;

  const updateMajorFilter = (major: string | undefined) => {
    const nextMedium =
      major && runnerFilters.mediumCategoryFilter
        ? getMediumCategories(definition, major).includes(runnerFilters.mediumCategoryFilter)
          ? runnerFilters.mediumCategoryFilter
          : undefined
        : runnerFilters.mediumCategoryFilter;

    void setRunnerFilters({
      ...runnerFilters,
      majorCategoryFilter: major,
      mediumCategoryFilter: nextMedium,
    });
  };

  return (
    <div className="filter-bar">
      <div className="filter-bar__inner">
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
            onChange={(e) =>
              void setRunnerFilters({
                ...runnerFilters,
                mediumCategoryFilter: e.target.value || undefined,
              })
            }
          >
            <option value="">すべて</option>
            {mediumCategories.map((medium) => (
              <option key={medium} value={medium}>
                {medium}
              </option>
            ))}
          </select>
        </label>

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

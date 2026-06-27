import { useEffect, useMemo, useRef, useState } from "react";
import type { TestCase } from "@qarows/shared";
import {
  getRunnerTargetMode,
  getTestCaseAggregateStatus,
  resolveRunnerTestCases,
} from "@qarows/shared";
import { useApp } from "@/context/AppContext";
import { formatRunnerFilterTitle } from "@/lib/utils";

function formatCategory(testCase: TestCase): string {
  const parts = [testCase.category.major];
  if (testCase.category.medium) parts.push(testCase.category.medium);
  if (testCase.category.minor) parts.push(testCase.category.minor);
  return parts.join(" › ");
}

function statusClass(status: ReturnType<typeof getTestCaseAggregateStatus>): string {
  if (status === "incomplete") return "runner-task-list__status--pending";
  if (status === "OK") return "runner-task-list__status--ok";
  if (status === "NG") return "runner-task-list__status--ng";
  if (status === "SKIP") return "runner-task-list__status--skip";
  return "runner-task-list__status--ok-ng";
}

function statusSymbol(status: ReturnType<typeof getTestCaseAggregateStatus>): string {
  if (status === "incomplete") return "○";
  if (status === "OK") return "✓";
  if (status === "NG") return "✗";
  if (status === "SKIP") return "–";
  return "!";
}

export function RunnerTaskList() {
  const { definition, results, session, runnerFilters, runnerIndex, setRunnerIndex } = useApp();
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

  if (!definition || !session) return null;

  const jumpToTest = (index: number) => {
    void setRunnerIndex(index);
    setMobileOpen(false);
  };

  const headerTitle =
    mode === "scenario" && scenario ? scenario.name : formatRunnerFilterTitle(definition, runnerFilters);

  const headerDescription =
    mode === "scenario" && scenario?.description ? scenario.description.trim() : undefined;

  return (
    <>
      <button
        type="button"
        className="runner-task-list__mobile-toggle"
        aria-expanded={mobileOpen}
        onClick={() => setMobileOpen((open) => !open)}
      >
        テスト一覧 ({targets.length})
      </button>

      <aside
        className={`runner-task-list${mobileOpen ? " runner-task-list--open" : ""}`}
        aria-label="テスト一覧"
      >
        <div className="runner-task-list__header">
          <h2 className="runner-task-list__title">{headerTitle}</h2>
          {headerDescription && (
            <div className="runner-task-list__description-wrap">
              <p
                className={`runner-task-list__description${
                  descriptionExpanded ? " runner-task-list__description--expanded" : ""
                }`}
              >
                {headerDescription}
              </p>
              {headerDescription.length > 80 && (
                <button
                  type="button"
                  className="runner-task-list__description-toggle"
                  onClick={() => setDescriptionExpanded((expanded) => !expanded)}
                >
                  {descriptionExpanded ? "閉じる" : "続きを読む"}
                </button>
              )}
            </div>
          )}
          <p className="runner-task-list__progress">
            {completedCount} / {targets.length} 完了
          </p>
        </div>

        <ul className="runner-task-list__items" ref={listRef}>
          {targets.length === 0 ? (
            <li className="runner-task-list__empty">対象テストがありません</li>
          ) : (
            targets.map((testCase, index) => {
              const status = getTestCaseAggregateStatus(
                testCase,
                definition,
                session.selectedEnvironmentIds,
                results?.results ?? {},
              );
              const isActive = runnerIndex === index && runnerIndex >= 0;

              return (
                <li
                  key={testCase.id}
                  ref={isActive ? activeItemRef : undefined}
                  className={`runner-task-list__item${isActive ? " runner-task-list__item--active" : ""}`}
                >
                  <button
                    type="button"
                    className="runner-task-list__button"
                    onClick={() => jumpToTest(index)}
                  >
                    <span className={`runner-task-list__status ${statusClass(status)}`}>
                      {statusSymbol(status)}
                    </span>
                    <span className="runner-task-list__meta">
                      <span className="runner-task-list__head">
                        <span className="runner-task-list__id">{testCase.id}</span>
                        <span className="runner-task-list__category">{formatCategory(testCase)}</span>
                      </span>
                      <span className="runner-task-list__description">{testCase.description}</span>
                    </span>
                  </button>
                </li>
              );
            })
          )}
        </ul>
      </aside>

      {mobileOpen && (
        <button
          type="button"
          className="runner-task-list__backdrop"
          aria-label="テスト一覧を閉じる"
          onClick={() => setMobileOpen(false)}
        />
      )}
    </>
  );
}

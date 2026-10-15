import { useCallback, useMemo, useRef, useState, type CSSProperties, type SyntheticEvent } from "react";
import { useNavigate } from "react-router-dom";
import {
  columnOrderingFeature,
  columnPinningFeature,
  columnSizingFeature,
  columnVisibilityFeature,
  createColumnHelper,
  flexRender,
  tableFeatures,
  useTable,
  type Column,
} from "@tanstack/react-table";
import { useVirtualizer } from "@tanstack/react-virtual";
import {
  nextBugId,
  resolveSessionTestTargets,
  resolveTestTargets,
  type TestCase,
  type TestResults,
  type TestStatus,
} from "@qarows/shared";
import { BugDialog, bugDraftToBug, type BugDialogDraft } from "./BugDialog";
import { useRunnerWorkspace } from "../context/runner-workspace";
import { useProjectRoutes } from "../hooks/useProjectRoutes";
import { useRunnerQueryState } from "../hooks/useRunnerQueryState";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuTrigger,
  StatusBadge,
} from "@qarows/ui";
import { useTranslation } from "@qarows/ui";
import { canJumpToRunner } from "../lib/jump-to-runner";
import { cn } from "@qarows/ui";

const ROW_HEIGHT = 40;

/** ランナーのボタン並びに合わせる */
const MATRIX_STATUS_OPTIONS: readonly TestStatus[] = ["OK", "NG", "SKIP"];

/** 列幅・固定・getIsLastColumn だけを使う。行の並べ替えや絞り込みは表側で済ませている */
const features = tableFeatures({
  columnSizingFeature,
  columnPinningFeature,
  columnOrderingFeature,
  columnVisibilityFeature,
});

type MatrixColumn = Column<typeof features, TestCase, unknown>;

/** 先頭固定は ID・分類のみ。確認内容は横スクロールで環境列を優先表示 */
const PINNED_START = ["id", "major", "medium", "minor"] as const;

const COLUMN_SIZES = {
  id: 76,
  major: 100,
  medium: 88,
  minor: 88,
  description: 160,
  env: 92,
} as const;

function cellWidthStyle(column: MatrixColumn): CSSProperties {
  const size = column.getSize();
  return {
    width: size,
    minWidth: size,
    maxWidth: size,
  };
}

function pinningStyles(column: MatrixColumn, isHeader = false): CSSProperties {
  const pinned = column.getIsPinned();
  if (!pinned) {
    return {
      position: "relative",
      zIndex: 0,
    };
  }

  const isStart = pinned === "start";
  const isLastStartPinned = isStart && column.getIsLastColumn("start");

  return {
    position: "sticky",
    left: isStart ? `${column.getStart("start")}px` : undefined,
    right: !isStart ? `${column.getAfter("end")}px` : undefined,
    zIndex: isHeader ? 2 : 1,
    backgroundColor: "var(--card)",
    width: column.getSize(),
    ...(isLastStartPinned
      ? { boxShadow: "2px 0 4px -2px color-mix(in oklab, var(--foreground) 12%, transparent)" }
      : {}),
  };
}

/** セル操作が行クリック（テスト実行へ遷移）に伝播しないようにする。Portal 内のメニューも React ツリー上は行の子 */
function stopRowActivation(event: SyntheticEvent) {
  event.stopPropagation();
}

const NOT_ENTERED = "none";

function EnvCell({
  testCase,
  envId,
  isTarget,
  editable,
  results,
  onSetStatus,
  onClear,
}: {
  testCase: TestCase;
  envId: string;
  isTarget: boolean;
  /** 自分のセッションで選択している端末のみ入力できる */
  editable: boolean;
  results: TestResults;
  onSetStatus: (testCase: TestCase, envId: string, status: TestStatus) => void;
  onClear: (testCaseId: string, envId: string) => void;
}) {
  const { t } = useTranslation();

  if (!isTarget) {
    return <div className="h-full w-full bg-muted/40" />;
  }

  const entry = results[testCase.id]?.[envId];
  const display = entry?.status ? (
    <StatusBadge status={entry.status} className="text-[0.65rem]" />
  ) : (
    <span className="text-xs text-muted-foreground">—</span>
  );

  if (!editable) return display;

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        className="flex h-7 w-full cursor-pointer items-center rounded-sm px-1 hover:bg-muted focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
        onClick={stopRowActivation}
        onKeyDown={stopRowActivation}
      >
        {display}
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" onClick={stopRowActivation} onKeyDown={stopRowActivation}>
        <DropdownMenuRadioGroup
          value={entry?.status ?? NOT_ENTERED}
          onValueChange={(value) => {
            if (value === NOT_ENTERED) {
              if (entry) onClear(testCase.id, envId);
              return;
            }
            onSetStatus(testCase, envId, value as TestStatus);
          }}
        >
          {MATRIX_STATUS_OPTIONS.map((status) => (
            <DropdownMenuRadioItem key={status} value={status}>
              <StatusBadge status={status} className="text-[0.65rem]" />
            </DropdownMenuRadioItem>
          ))}
          <DropdownMenuRadioItem value={NOT_ENTERED} className="text-xs">
            {t("runner.matrixNotEntered")}
          </DropdownMenuRadioItem>
        </DropdownMenuRadioGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

export function TestMatrixTable({
  testCases,
}: {
  testCases: TestCase[];
}) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { definition, results, session, updateResults, clearTestResult, addBug } = useRunnerWorkspace();
  const { runnerFilters } = useRunnerQueryState();
  const { path } = useProjectRoutes();
  const tableContainerRef = useRef<HTMLDivElement>(null);
  const [bugTarget, setBugTarget] = useState<{ testCase: TestCase; envId: string } | null>(null);
  const [bugDialogBusy, setBugDialogBusy] = useState(false);
  const [bugCreateMore, setBugCreateMore] = useState(false);
  const [bugFormKey, setBugFormKey] = useState(0);

  const handleSetStatus = useCallback(
    (testCase: TestCase, envId: string, status: TestStatus) => {
      if (!session) return;
      void updateResults(testCase.id, envId, {
        status,
        executedAt: new Date().toISOString(),
        executedBy: session.executorName,
      });
      // ランナーと同じく NG 入力時にバグ起票を促す
      if (status === "NG") setBugTarget({ testCase, envId });
    },
    [session, updateResults],
  );

  const closeBugDialog = useCallback((cancelled: boolean) => {
    setBugTarget(null);
    if (cancelled) setBugCreateMore(false);
  }, []);

  const handleBugSubmit = useCallback(
    async (draft: BugDialogDraft) => {
      if (!results) return;
      setBugDialogBusy(true);
      try {
        await addBug(bugDraftToBug(nextBugId(results.bugs), draft));
        if (bugCreateMore) {
          setBugFormKey((key) => key + 1);
          return;
        }
        closeBugDialog(false);
      } finally {
        setBugDialogBusy(false);
      }
    },
    [addBug, bugCreateMore, closeBugDialog, results],
  );

  /** 環境列のセルごとに再解決しないよう、対象環境をテストケース単位で先に引く */
  const targetEnvIdsByTestCase = useMemo(() => {
    if (!definition) return new Map<string, string[]>();
    return new Map(
      testCases.map((testCase) => [
        testCase.id,
        resolveTestTargets(testCase, definition).environmentIds,
      ]),
    );
  }, [definition, testCases]);

  const columns = useMemo(() => {
    if (!definition) return [];

    const helper = createColumnHelper<typeof features, TestCase>();

    const metaColumns = [
      helper.accessor("id", {
        id: "id",
        header: "ID",
        size: COLUMN_SIZES.id,
        cell: (info) => (
          <span className="font-mono text-xs font-semibold">{info.getValue()}</span>
        ),
      }),
      helper.accessor((row) => row.category.major, {
        id: "major",
        header: t("runner.majorCol"),
        size: COLUMN_SIZES.major,
        cell: (info) => <span className="text-xs">{info.getValue()}</span>,
      }),
      helper.accessor((row) => row.category.medium ?? "", {
        id: "medium",
        header: t("runner.mediumCol"),
        size: COLUMN_SIZES.medium,
        cell: (info) => (
          <span className="text-xs text-muted-foreground">{info.getValue() || "—"}</span>
        ),
      }),
      helper.accessor((row) => row.category.minor ?? "", {
        id: "minor",
        header: t("runner.minorCol"),
        size: COLUMN_SIZES.minor,
        cell: (info) => (
          <span className="text-xs text-muted-foreground">{info.getValue() || "—"}</span>
        ),
      }),
      helper.accessor("description", {
        id: "description",
        header: t("runner.steps"),
        size: COLUMN_SIZES.description,
        cell: (info) => (
          <span className="block max-w-[160px] truncate text-xs" title={info.getValue()}>
            {info.getValue()}
          </span>
        ),
      }),
    ];

    const envColumns = definition.environments.map((env) =>
      helper.display({
        id: `env-${env.id}`,
        header: () => (
          <span className="block truncate" title={env.name}>
            {env.name}
          </span>
        ),
        size: COLUMN_SIZES.env,
        cell: ({ row }) =>
          results ? (
            <EnvCell
              testCase={row.original}
              envId={env.id}
              isTarget={targetEnvIdsByTestCase.get(row.original.id)?.includes(env.id) ?? false}
              editable={session?.selectedEnvironmentIds.includes(env.id) ?? false}
              results={results.results}
              onSetStatus={handleSetStatus}
              onClear={(testCaseId, envId) => void clearTestResult(testCaseId, envId)}
            />
          ) : null,
      }),
    );

    return helper.columns([...metaColumns, ...envColumns]);
  }, [clearTestResult, definition, handleSetStatus, results, session, t, targetEnvIdsByTestCase]);

  const table = useTable({
    features,
    data: testCases,
    columns,
    state: {
      columnPinning: {
        start: [...PINNED_START],
        end: [],
      },
    },
    defaultColumn: {
      minSize: 60,
      size: 80,
    },
  });

  const { rows } = table.getRowModel();

  const rowVirtualizer = useVirtualizer({
    count: rows.length,
    getScrollElement: () => tableContainerRef.current,
    estimateSize: () => ROW_HEIGHT,
    overscan: 8,
  });

  const virtualRows = rowVirtualizer.getVirtualItems();
  const columnCount = table.getVisibleLeafColumns().length;
  const paddingTop = virtualRows.length > 0 ? virtualRows[0].start : 0;
  const paddingBottom =
    virtualRows.length > 0
      ? rowVirtualizer.getTotalSize() - virtualRows[virtualRows.length - 1].end
      : 0;

  if (!definition || !results) return null;

  if (rows.length === 0) {
    return (
      <div className="rounded-lg border bg-card py-12 text-center text-sm text-muted-foreground">
        {t("runner.noMatchingTests")}
      </div>
    );
  }

  const handleRowActivate = (testCase: TestCase) => {
    if (!canJumpToRunner(testCase.id, definition, session)) return;
    navigate(path("run", runnerFilters, testCase.id));
  };

  return (
    <>
      <div
        ref={tableContainerRef}
        className="h-full min-h-0 overflow-auto rounded-lg border bg-card"
      >
        <table
          className="table-fixed border-separate border-spacing-0 text-left"
          style={{ width: table.getTotalSize(), minWidth: "100%" }}
        >
          <colgroup>
            {table.getVisibleLeafColumns().map((column) => (
              <col key={column.id} style={{ width: column.getSize() }} />
            ))}
          </colgroup>
          <thead className="sticky top-0 z-[4] bg-card shadow-sm">
            {table.getHeaderGroups().map((headerGroup) => (
              <tr key={headerGroup.id} className="border-b border-border/60">
                {headerGroup.headers.map((header) => (
                  <th
                    key={header.id}
                    className="overflow-hidden border-b border-r border-border/60 px-2 py-2 text-xs font-semibold text-muted-foreground"
                    style={{
                      ...cellWidthStyle(header.column),
                      ...pinningStyles(header.column, true),
                    }}
                  >
                    {header.isPlaceholder
                      ? null
                      : flexRender(header.column.columnDef.header, header.getContext())}
                  </th>
                ))}
              </tr>
            ))}
          </thead>
          <tbody style={{ overflowAnchor: "none" }}>
            {paddingTop > 0 ? (
              <tr aria-hidden className="pointer-events-none">
                <td colSpan={columnCount} style={{ height: paddingTop, padding: 0, border: "none" }} />
              </tr>
            ) : null}
            {virtualRows.map((virtualRow) => {
              const row = rows[virtualRow.index];
              const testCase = row.original;
              const jumpable = canJumpToRunner(testCase.id, definition, session);

              return (
                <tr
                  key={row.id}
                  data-index={virtualRow.index}
                  className={cn(
                    "border-b border-border/40 transition-colors",
                    jumpable
                      ? "cursor-pointer hover:bg-muted/50 focus-visible:bg-muted/50 focus-visible:outline-none"
                      : "hover:bg-muted/20",
                  )}
                  style={{ height: ROW_HEIGHT }}
                  tabIndex={jumpable ? 0 : undefined}
                  onClick={() => void handleRowActivate(testCase)}
                  onKeyDown={(event) => {
                    if (!jumpable) return;
                    if (event.key === "Enter" || event.key === " ") {
                      event.preventDefault();
                      void handleRowActivate(testCase);
                    }
                  }}
                  title={
                    jumpable
                      ? t("runner.clickToRun")
                      : session
                        ? t("runner.outOfSession")
                        : t("runner.sessionRequired")
                  }
                >
                  {row.getVisibleCells().map((cell) => (
                    <td
                      key={cell.id}
                      className="border-r border-border/40 px-2 align-middle"
                      style={{
                        height: ROW_HEIGHT,
                        ...cellWidthStyle(cell.column),
                        ...pinningStyles(cell.column),
                      }}
                    >
                      {flexRender(cell.column.columnDef.cell, cell.getContext())}
                    </td>
                  ))}
                </tr>
              );
            })}
            {paddingBottom > 0 ? (
              <tr aria-hidden className="pointer-events-none">
                <td colSpan={columnCount} style={{ height: paddingBottom, padding: 0, border: "none" }} />
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>
      {bugTarget && session && (
        <BugDialog
          open
          testCase={bugTarget.testCase}
          environments={definition.environments}
          availableEnvironmentIds={
            resolveSessionTestTargets(bugTarget.testCase, definition, session.selectedEnvironmentIds)
              .environmentIds
          }
          initialTestCaseLinked
          initialEnvironmentIds={[bugTarget.envId]}
          createMore={bugCreateMore}
          formKey={bugFormKey}
          defaultAssignee={session.executorName}
          busy={bugDialogBusy}
          onCreateMoreChange={setBugCreateMore}
          onSubmit={handleBugSubmit}
          onCancel={() => closeBugDialog(true)}
        />
      )}
    </>
  );
}

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type CSSProperties } from "react";
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
  isResultEntryValid,
  nextBugId,
  resolveSessionTestTargets,
  resolveTestTargets,
  type SessionConfig,
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
import { canJumpToRunner, runnerFiltersForJump } from "../lib/jump-to-runner";
import { cn } from "@qarows/ui";

const ROW_HEIGHT = 40;

const wrapTextClass = "whitespace-pre-wrap break-words";

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

const NOT_ENTERED = "none";

interface MatrixCellContextValue {
  results: TestResults;
  session: SessionConfig | null;
  onSetStatus: (testCase: TestCase, envId: string, status: TestStatus) => void;
  onClear: (testCaseId: string, envId: string) => void;
  canJump: (testCaseId: string) => boolean;
  onJump: (testCaseId: string) => void;
}

/**
 * 結果やハンドラは列定義に閉じ込めず Context で渡す。flexRender はセル関数を
 * コンポーネントとして描画するため、結果が変わるたびに列定義を作り直すと全セルが
 * 再マウントされ、StatusBadge の出現アニメーションが一斉に再生されてちらつく
 */
const MatrixCellContext = createContext<MatrixCellContextValue | null>(null);

/** テスト実行への遷移は ID だけで受け付ける（行全体だとセル操作と競合する） */
function IdCell({ testCaseId }: { testCaseId: string }) {
  const { t } = useTranslation();
  const context = useContext(MatrixCellContext);
  const textClass = "font-mono text-xs font-semibold";

  if (!context?.canJump(testCaseId)) {
    return (
      <span
        className={textClass}
        title={context?.session ? t("runner.outOfSession") : t("runner.sessionRequired")}
      >
        {testCaseId}
      </span>
    );
  }

  return (
    <button
      type="button"
      className={cn(
        textClass,
        "cursor-pointer rounded-sm text-primary underline-offset-2 hover:underline focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none",
      )}
      title={t("runner.clickToRun")}
      onClick={() => context.onJump(testCaseId)}
    >
      {testCaseId}
    </button>
  );
}

function EnvCell({
  testCase,
  envId,
  isTarget,
}: {
  testCase: TestCase;
  envId: string;
  isTarget: boolean;
}) {
  const { t } = useTranslation();
  const context = useContext(MatrixCellContext);
  if (!context) return null;
  const { results, session, onSetStatus, onClear } = context;
  // 自分のセッションで選択している端末のみ入力できる
  const editable = session?.selectedEnvironmentIds.includes(envId) ?? false;

  if (!isTarget) {
    return <div className="h-full w-full bg-muted/40" />;
  }

  const entry = results[testCase.id]?.[envId];
  // ランナー・ダッシュボードと同じく、テストケースの version が上がる前の結果は未実施として扱う
  const validStatus = isResultEntryValid(entry, testCase) ? entry?.status : undefined;
  const stale = entry != null && validStatus == null;
  const display = validStatus ? (
    <StatusBadge status={validStatus} className="text-[0.65rem]" />
  ) : (
    <span className={cn("block truncate text-xs text-muted-foreground", stale && "text-destructive")}>
      {stale ? t("runner.retestNeeded") : "—"}
    </span>
  );

  if (!editable) return display;

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        className="flex h-7 w-full cursor-pointer items-center rounded-sm px-1 hover:bg-muted focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
      >
        {display}
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start">
        <DropdownMenuRadioGroup
          value={validStatus ?? NOT_ENTERED}
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
  environmentIds,
  compact,
}: {
  testCases: TestCase[];
  /** 表示する環境列 */
  environmentIds: string[];
  /** true: 1 行固定で文字列を省略 / false: 全文を折り返して行の高さを可変にする */
  compact: boolean;
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

  /**
   * 環境列のセルごとに再解決しないよう、対象環境をテストケース単位で先に引く。
   * 表示中の testCases（結果で絞り込まれる）ではなく定義全体から作り、結果の更新で
   * 列定義が作り直されないようにする（MatrixCellContext のコメント参照）
   */
  const targetEnvIdsByTestCase = useMemo(() => {
    if (!definition) return new Map<string, string[]>();
    return new Map(
      definition.testCases.map((testCase) => [
        testCase.id,
        resolveTestTargets(testCase, definition).environmentIds,
      ]),
    );
  }, [definition]);

  const columns = useMemo(() => {
    if (!definition) return [];

    const helper = createColumnHelper<typeof features, TestCase>();

    const metaColumns = [
      helper.accessor("id", {
        id: "id",
        header: "ID",
        size: COLUMN_SIZES.id,
        cell: (info) => <IdCell testCaseId={info.getValue()} />,
      }),
      helper.accessor((row) => row.category.major, {
        id: "major",
        header: t("runner.majorCol"),
        size: COLUMN_SIZES.major,
        cell: (info) => <span className={cn("text-xs", !compact && wrapTextClass)}>{info.getValue()}</span>,
      }),
      helper.accessor((row) => row.category.medium ?? "", {
        id: "medium",
        header: t("runner.mediumCol"),
        size: COLUMN_SIZES.medium,
        cell: (info) => (
          <span className={cn("text-xs text-muted-foreground", !compact && wrapTextClass)}>
            {info.getValue() || "—"}
          </span>
        ),
      }),
      helper.accessor((row) => row.category.minor ?? "", {
        id: "minor",
        header: t("runner.minorCol"),
        size: COLUMN_SIZES.minor,
        cell: (info) => (
          <span className={cn("text-xs text-muted-foreground", !compact && wrapTextClass)}>
            {info.getValue() || "—"}
          </span>
        ),
      }),
      helper.accessor("description", {
        id: "description",
        header: t("runner.steps"),
        size: COLUMN_SIZES.description,
        cell: (info) =>
          compact ? (
            <span className="block max-w-[160px] truncate text-xs" title={info.getValue()}>
              {info.getValue()}
            </span>
          ) : (
            <span className={cn("block text-xs", wrapTextClass)}>{info.getValue().trimEnd()}</span>
          ),
      }),
    ];

    const envColumns = definition.environments
      .filter((env) => environmentIds.includes(env.id))
      .map((env) =>
        helper.display({
          id: `env-${env.id}`,
          header: () => (
            <span className="block truncate" title={env.name}>
              {env.name}
            </span>
          ),
          size: COLUMN_SIZES.env,
          cell: ({ row }) => (
            <EnvCell
              testCase={row.original}
              envId={env.id}
              isTarget={targetEnvIdsByTestCase.get(row.original.id)?.includes(env.id) ?? false}
            />
          ),
        }),
      );

    return helper.columns([...metaColumns, ...envColumns]);
  }, [compact, definition, environmentIds, t, targetEnvIdsByTestCase]);

  const cellContext = useMemo<MatrixCellContextValue | null>(
    () =>
      results && definition
        ? {
            results: results.results,
            session,
            onSetStatus: handleSetStatus,
            onClear: (testCaseId, envId) => void clearTestResult(testCaseId, envId),
            canJump: (testCaseId) => canJumpToRunner(testCaseId, definition, session),
            onJump: (testCaseId) =>
              session &&
              navigate(
                path("run", runnerFiltersForJump(testCaseId, definition, session, results, runnerFilters), testCaseId),
              ),
          }
        : null,
    [clearTestResult, definition, handleSetStatus, navigate, path, results, runnerFilters, session],
  );

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

  // 表示モードが変わると行の高さが変わるため、計測済みサイズを捨てる
  useEffect(() => {
    rowVirtualizer.measure();
  }, [compact, rowVirtualizer]);

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


  return (
    <>
      <div
        ref={tableContainerRef}
        className="h-full min-h-0 overflow-auto rounded-lg border bg-card"
      >
        <MatrixCellContext.Provider value={cellContext}>
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

                return (
                  <tr
                    key={row.id}
                    ref={compact ? undefined : rowVirtualizer.measureElement}
                    data-index={virtualRow.index}
                    className="border-b border-border/40 transition-colors hover:bg-muted/20"
                    style={compact ? { height: ROW_HEIGHT } : undefined}
                  >
                    {row.getVisibleCells().map((cell) => (
                      <td
                        key={cell.id}
                        className={cn("border-r border-border/40 px-2 align-middle", !compact && "py-2")}
                        style={{
                          height: compact ? ROW_HEIGHT : undefined,
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
        </MatrixCellContext.Provider>
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

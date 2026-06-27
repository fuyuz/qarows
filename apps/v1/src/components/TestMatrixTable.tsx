import { useMemo, useRef, type CSSProperties } from "react";
import { useNavigate } from "react-router-dom";
import {
  createColumnHelper,
  flexRender,
  getCoreRowModel,
  useReactTable,
  type Column,
} from "@tanstack/react-table";
import { useVirtualizer } from "@tanstack/react-virtual";
import {
  resolveTestTargets,
  type TestCase,
  type TestDefinition,
  type TestResults,
} from "@qarows/shared";
import { useApp } from "@/context/AppContext";
import { useProjectRoutes } from "@/hooks/useProjectRoutes";
import { useRunnerQueryState } from "@/hooks/useRunnerQueryState";
import { StatusBadge } from "@/components/qa-ui";
import { canJumpToRunner } from "@/lib/jump-to-runner";
import { cn } from "@/lib/cn";

const ROW_HEIGHT = 40;

/** 左固定は ID・分類のみ。確認内容は横スクロールで環境列を優先表示 */
const PINNED_LEFT = ["id", "major", "medium", "minor"] as const;

const COLUMN_SIZES = {
  id: 76,
  major: 100,
  medium: 88,
  minor: 88,
  description: 160,
  env: 92,
} as const;

function cellWidthStyle(column: Column<TestCase, unknown>): CSSProperties {
  const size = column.getSize();
  return {
    width: size,
    minWidth: size,
    maxWidth: size,
  };
}

function pinningStyles(
  column: Column<TestCase, unknown>,
  isHeader = false,
): CSSProperties {
  const pinned = column.getIsPinned();
  if (!pinned) {
    return {
      position: "relative",
      zIndex: 0,
    };
  }

  const isLeft = pinned === "left";
  const isLastLeftPinned = isLeft && column.getIsLastColumn("left");

  return {
    position: "sticky",
    left: isLeft ? `${column.getStart("left")}px` : undefined,
    right: !isLeft ? `${column.getAfter("right")}px` : undefined,
    zIndex: isHeader ? 2 : 1,
    backgroundColor: "var(--card)",
    width: column.getSize(),
    ...(isLastLeftPinned
      ? { boxShadow: "2px 0 4px -2px color-mix(in oklab, var(--foreground) 12%, transparent)" }
      : {}),
  };
}

function EnvCell({
  testCase,
  envId,
  definition,
  results,
}: {
  testCase: TestCase;
  envId: string;
  definition: TestDefinition;
  results: TestResults;
}) {
  const targets = resolveTestTargets(testCase, definition);
  const isTarget = targets.environmentIds.includes(envId);

  if (!isTarget) {
    return <div className="h-full w-full bg-muted/40" />;
  }

  const entry = results[testCase.id]?.[envId];
  if (!entry?.status) {
    return <span className="text-xs text-muted-foreground">—</span>;
  }

  return <StatusBadge status={entry.status} className="text-[0.65rem]" />;
}

export function TestMatrixTable({
  testCases,
}: {
  testCases: TestCase[];
}) {
  const navigate = useNavigate();
  const { definition, results, session } = useApp();
  const { runnerFilters } = useRunnerQueryState();
  const { path } = useProjectRoutes();
  const tableContainerRef = useRef<HTMLDivElement>(null);

  const columns = useMemo(() => {
    if (!definition) return [];

    const helper = createColumnHelper<TestCase>();

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
        header: "大項目",
        size: COLUMN_SIZES.major,
        cell: (info) => <span className="text-xs">{info.getValue()}</span>,
      }),
      helper.accessor((row) => row.category.medium ?? "", {
        id: "medium",
        header: "中項目",
        size: COLUMN_SIZES.medium,
        cell: (info) => (
          <span className="text-xs text-muted-foreground">{info.getValue() || "—"}</span>
        ),
      }),
      helper.accessor((row) => row.category.minor ?? "", {
        id: "minor",
        header: "小項目",
        size: COLUMN_SIZES.minor,
        cell: (info) => (
          <span className="text-xs text-muted-foreground">{info.getValue() || "—"}</span>
        ),
      }),
      helper.accessor("description", {
        id: "description",
        header: "確認内容",
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
        header: env.name,
        size: COLUMN_SIZES.env,
        cell: ({ row }) =>
          results ? (
            <EnvCell
              testCase={row.original}
              envId={env.id}
              definition={definition}
              results={results.results}
            />
          ) : null,
      }),
    );

    return [...metaColumns, ...envColumns];
  }, [definition, results]);

  const table = useReactTable({
    data: testCases,
    columns,
    getCoreRowModel: getCoreRowModel(),
    state: {
      columnPinning: {
        left: [...PINNED_LEFT],
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
        該当するテストがありません
      </div>
    );
  }

  const handleRowActivate = (testCase: TestCase) => {
    if (!canJumpToRunner(testCase.id, definition, session)) return;
    navigate(path("run", runnerFilters, testCase.id));
  };

  return (
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
                  className="border-b border-r border-border/60 px-2 py-2 text-xs font-semibold text-muted-foreground whitespace-nowrap"
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
                    ? "クリックでテスト実行へ"
                    : session
                      ? "セッションの対象外"
                      : "セッション設定が必要"
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
  );
}

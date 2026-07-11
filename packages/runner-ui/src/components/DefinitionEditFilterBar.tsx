import { useMemo, useState } from "react";
import type { TestCase, TestDefinition } from "@qarows/shared";
import {
  Button,
  Checkbox,
  Input,
  Label,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  cn,
} from "@qarows/ui";
import { getMajorCategories, getMediumCategories, getMinorCategories } from "../lib/runner-utils";

const ALL = "__all__";

export interface DefinitionEditFilters {
  major?: string;
  medium?: string;
  minor?: string;
  query: string;
}

export function filterDefinitionTestCases(
  definition: TestDefinition,
  filters: DefinitionEditFilters,
): TestCase[] {
  const q = filters.query.trim().toLowerCase();
  return definition.testCases.filter((tc) => {
    if (filters.major && tc.category.major !== filters.major) return false;
    if (filters.medium && (tc.category.medium ?? "") !== filters.medium) return false;
    if (filters.minor && (tc.category.minor ?? "") !== filters.minor) return false;
    if (!q) return true;
    const haystack = [tc.id, tc.description, tc.prerequisites ?? ""].join("\n").toLowerCase();
    return haystack.includes(q);
  });
}

export function DefinitionEditFilterBar({
  definition,
  filters,
  onChange,
  filteredCount,
  onAddTestCase,
  compact,
  onCompactChange,
  className,
}: {
  definition: TestDefinition;
  filters: DefinitionEditFilters;
  onChange: (next: DefinitionEditFilters) => void;
  filteredCount: number;
  onAddTestCase: () => void;
  compact: boolean;
  onCompactChange: (compact: boolean) => void;
  className?: string;
}) {
  const majors = useMemo(() => getMajorCategories(definition), [definition]);
  const mediums = useMemo(
    () => (filters.major ? getMediumCategories(definition, filters.major) : []),
    [definition, filters.major],
  );
  const minors = useMemo(
    () =>
      filters.major && filters.medium
        ? getMinorCategories(definition, filters.major, filters.medium)
        : [],
    [definition, filters.major, filters.medium],
  );

  return (
    <div
      className={cn(
        "sticky top-0 z-10 border-b border-border/80 bg-background/95 px-5 py-3 backdrop-blur",
        className,
      )}
    >
      <div className="mx-auto flex w-full max-w-3xl flex-col gap-3">
        <div className="flex flex-wrap items-end gap-2">
          <div className="grid min-w-[8rem] flex-1 gap-1">
            <Label className="text-xs text-muted-foreground">大分類</Label>
            <Select
              value={filters.major ?? ALL}
              onValueChange={(value) =>
                onChange({
                  ...filters,
                  major: value === ALL ? undefined : value,
                  medium: undefined,
                  minor: undefined,
                })
              }
            >
              <SelectTrigger className="h-8">
                <SelectValue placeholder="すべて" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={ALL}>すべて</SelectItem>
                {majors.map((major) => (
                  <SelectItem key={major} value={major}>
                    {major}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="grid min-w-[8rem] flex-1 gap-1">
            <Label className="text-xs text-muted-foreground">中分類</Label>
            <Select
              value={filters.medium ?? ALL}
              disabled={!filters.major}
              onValueChange={(value) =>
                onChange({
                  ...filters,
                  medium: value === ALL ? undefined : value,
                  minor: undefined,
                })
              }
            >
              <SelectTrigger className="h-8">
                <SelectValue placeholder="すべて" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={ALL}>すべて</SelectItem>
                {mediums.map((medium) => (
                  <SelectItem key={medium} value={medium}>
                    {medium}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="grid min-w-[8rem] flex-1 gap-1">
            <Label className="text-xs text-muted-foreground">小分類</Label>
            <Select
              value={filters.minor ?? ALL}
              disabled={!filters.medium}
              onValueChange={(value) =>
                onChange({
                  ...filters,
                  minor: value === ALL ? undefined : value,
                })
              }
            >
              <SelectTrigger className="h-8">
                <SelectValue placeholder="すべて" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={ALL}>すべて</SelectItem>
                {minors.map((minor) => (
                  <SelectItem key={minor} value={minor}>
                    {minor}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Input
            value={filters.query}
            onChange={(e) => onChange({ ...filters, query: e.target.value })}
            placeholder="ID・確認内容・前提条件で検索"
            className="h-8 min-w-[12rem] flex-1"
          />
          <label className="flex shrink-0 items-center gap-2 text-xs text-muted-foreground whitespace-nowrap">
            <Checkbox
              checked={compact}
              onCheckedChange={(checked) => onCompactChange(checked === true)}
            />
            コンパクト
          </label>
          <p className="text-xs text-muted-foreground whitespace-nowrap">
            {filteredCount} / {definition.testCases.length} 件
          </p>
          <Button type="button" size="sm" variant="outline" onClick={onAddTestCase}>
            ケース追加
          </Button>
        </div>
      </div>
    </div>
  );
}

export function useDefinitionEditFilters() {
  return useState<DefinitionEditFilters>({ query: "" });
}

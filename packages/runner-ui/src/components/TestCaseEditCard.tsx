import { useState } from "react";
import {
  getTestCaseVersion,
  resolveTestTargets,
  type TargetEnvironmentSpec,
  type TargetRequirement,
  type TestCase,
  type TestDefinition,
} from "@qarows/shared";
import {
  Badge,
  Button,
  Checkbox,
  Input,
  Label,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  Textarea,
  cn,
} from "@qarows/ui";
import { ChevronDown, ChevronRight, Trash2 } from "lucide-react";

function categoryPath(category: TestCase["category"]): string {
  return [category.major, category.medium, category.minor].filter(Boolean).join(" › ");
}

export function TestCaseEditCard({
  testCase,
  definition,
  modified,
  isNew,
  compact = false,
  onUpdate,
  onChangeId,
  onSetTargets,
  onRemove,
}: {
  testCase: TestCase;
  definition: TestDefinition;
  modified: boolean;
  isNew: boolean;
  compact?: boolean;
  onUpdate: (patch: Partial<TestCase>) => void;
  onChangeId: (newId: string) => void;
  onSetTargets: (spec: TargetEnvironmentSpec | undefined) => void;
  onRemove: () => void;
}) {
  const [detailsOpen, setDetailsOpen] = useState(isNew);
  const resolved = resolveTestTargets(testCase, definition);
  const envNames = Object.fromEntries(definition.environments.map((e) => [e.id, e.name]));
  const hasOverride = testCase.targetEnvironments != null;
  const override = testCase.targetEnvironments;
  const targetsSummary =
    resolved.environmentIds.length > 0
      ? `${resolved.required} — ${resolved.environmentIds.map((id) => envNames[id] ?? id).join(", ")}`
      : "対象外";

  return (
    <article
      className={cn(
        "rounded-lg border bg-card shadow-sm",
        compact ? "px-2.5 py-2" : "px-4 py-4",
        modified ? "border-amber-300/80" : "border-border/80",
      )}
    >
      <div className={cn("flex min-w-0 items-center gap-2", compact ? "mb-1.5" : "mb-3 flex-wrap")}>
        {isNew ? (
          <Input
            value={testCase.id}
            className={cn("shrink-0 font-mono", compact ? "h-7 w-24 text-xs" : "h-8 w-32 text-sm")}
            onChange={(e) => onChangeId(e.target.value)}
            aria-label="テストケース ID"
          />
        ) : (
          <Badge
            variant="secondary"
            className={cn("shrink-0 font-mono", compact && "px-1.5 py-0 text-[10px]")}
          >
            {testCase.id}
          </Badge>
        )}
        {!compact ? (
          <span className="min-w-0 flex-1 truncate whitespace-nowrap text-xs text-muted-foreground">
            {categoryPath(testCase.category) || "分類未設定"}
          </span>
        ) : (
          <span className="min-w-0 flex-1" />
        )}
        {modified ? (
          <Badge
            variant="secondary"
            className={cn("bg-amber-100 text-amber-950", compact && "px-1.5 py-0 text-[10px]")}
          >
            変更
          </Badge>
        ) : null}
        {isNew && !compact ? (
          <Badge variant="secondary" className="bg-green-100 text-green-900">
            新規
          </Badge>
        ) : null}
        <Button
          type="button"
          size="icon"
          variant="ghost"
          className={cn("shrink-0 text-muted-foreground", compact ? "size-6" : "size-8")}
          onClick={() => {
            if (window.confirm(`「${testCase.id}」を削除しますか？`)) onRemove();
          }}
          aria-label={`${testCase.id} を削除`}
        >
          <Trash2 className={compact ? "size-3.5" : "size-4"} />
        </Button>
      </div>

      <div className={cn("grid gap-1", compact ? "mb-1.5" : "mb-3")}>
        {!compact ? <Label className="text-sm font-semibold">確認内容</Label> : null}
        <Textarea
          value={testCase.description}
          rows={compact ? 2 : 3}
          aria-label="確認内容"
          placeholder={compact ? "確認内容" : undefined}
          className={cn(
            "resize-y font-medium leading-relaxed",
            compact
              ? "min-h-[2.75rem] px-2 py-1.5 text-sm"
              : "min-h-[4.5rem] text-base",
          )}
          onChange={(e) => onUpdate({ description: e.target.value })}
        />
      </div>

      <div className={cn("grid gap-1", compact ? "mb-0" : "mb-3")}>
        {!compact ? <Label className="text-xs text-muted-foreground">前提条件</Label> : null}
        <Textarea
          value={testCase.prerequisites ?? ""}
          rows={compact ? 1 : 2}
          aria-label="前提条件"
          placeholder={compact ? "前提条件（任意）" : "任意"}
          className={cn(
            "resize-y text-muted-foreground",
            compact ? "min-h-[1.75rem] px-2 py-1 text-xs" : "min-h-[2.5rem] text-sm",
          )}
          onChange={(e) =>
            onUpdate({
              prerequisites: e.target.value || undefined,
            })
          }
        />
      </div>

      {!compact ? (
        <div className="rounded-md border border-border/60 bg-muted/20">
          <button
            type="button"
            className="flex w-full min-w-0 items-center gap-2 overflow-hidden px-3 py-2 text-left text-sm"
            onClick={() => setDetailsOpen((v) => !v)}
            aria-expanded={detailsOpen}
          >
            {detailsOpen ? (
              <ChevronDown className="size-4 shrink-0 text-muted-foreground" />
            ) : (
              <ChevronRight className="size-4 shrink-0 text-muted-foreground" />
            )}
            <span className="shrink-0 font-medium text-muted-foreground">詳細</span>
            <span className="min-w-0 flex-1 truncate whitespace-nowrap text-xs text-muted-foreground">
              {categoryPath(testCase.category)} · {targetsSummary}
            </span>
          </button>
          {detailsOpen ? (
            <div className="space-y-4 border-t border-border/60 px-3 py-3">
              <div className="space-y-2">
                <p className="text-xs font-medium text-muted-foreground">分類</p>
                <div className="grid gap-2 sm:grid-cols-3">
                  <div className="grid gap-1">
                    <Label className="text-xs text-muted-foreground">大分類</Label>
                    <Input
                      value={testCase.category.major}
                      className="h-8"
                      onChange={(e) =>
                        onUpdate({
                          category: { ...testCase.category, major: e.target.value },
                        })
                      }
                    />
                  </div>
                  <div className="grid gap-1">
                    <Label className="text-xs text-muted-foreground">中分類</Label>
                    <Input
                      value={testCase.category.medium ?? ""}
                      className="h-8"
                      placeholder="任意"
                      onChange={(e) => {
                        const medium = e.target.value;
                        onUpdate({
                          category: {
                            major: testCase.category.major,
                            ...(medium ? { medium } : {}),
                            ...(medium && testCase.category.minor
                              ? { minor: testCase.category.minor }
                              : {}),
                          },
                        });
                      }}
                    />
                  </div>
                  <div className="grid gap-1">
                    <Label className="text-xs text-muted-foreground">小分類</Label>
                    <Input
                      value={testCase.category.minor ?? ""}
                      className="h-8"
                      placeholder="任意"
                      onChange={(e) => {
                        const minor = e.target.value;
                        onUpdate({
                          category: {
                            major: testCase.category.major,
                            ...(testCase.category.medium
                              ? { medium: testCase.category.medium }
                              : {}),
                            ...(minor ? { minor } : {}),
                          },
                        });
                      }}
                    />
                  </div>
                </div>
              </div>

              <div className="space-y-2">
                <p className="text-xs font-medium text-muted-foreground">対象端末</p>
                <label className="flex items-center gap-2 text-sm">
                  <Checkbox
                    checked={hasOverride}
                    onCheckedChange={(checked) => {
                      if (checked) {
                        onSetTargets({ required: "all" });
                      } else {
                        onSetTargets(undefined);
                      }
                    }}
                  />
                  ケース単位で上書きする
                </label>
                {hasOverride && override ? (
                  <>
                    <div className="grid gap-1">
                      <Label className="text-xs text-muted-foreground">完了条件</Label>
                      <Select
                        value={override.required}
                        onValueChange={(value) =>
                          onSetTargets({
                            ...override,
                            required: value as TargetRequirement,
                          })
                        }
                      >
                        <SelectTrigger className="h-8 w-40">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="all">all（すべて）</SelectItem>
                          <SelectItem value="any">any（いずれか）</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="grid gap-2">
                      <Label className="text-xs text-muted-foreground">
                        対象端末（未選択 = 上位の有効プール全体）
                      </Label>
                      <div className="flex flex-wrap gap-3">
                        {definition.environments.map((env) => {
                          const selected = override.targets?.includes(env.id) ?? false;
                          return (
                            <label key={env.id} className="flex items-center gap-2 text-sm">
                              <Checkbox
                                checked={selected}
                                onCheckedChange={(checked) => {
                                  const current = new Set(override.targets ?? []);
                                  if (checked) current.add(env.id);
                                  else current.delete(env.id);
                                  const targets = [...current];
                                  onSetTargets({
                                    required: override.required,
                                    ...(targets.length > 0 ? { targets } : {}),
                                  });
                                }}
                              />
                              {env.name}
                            </label>
                          );
                        })}
                      </div>
                    </div>
                  </>
                ) : null}
                <p className="text-xs text-muted-foreground">解決結果: {targetsSummary}</p>
              </div>

              <div className="grid gap-1">
                <Label className="text-xs text-muted-foreground">version</Label>
                <Input
                  type="number"
                  min={1}
                  className="h-8 w-24"
                  value={getTestCaseVersion(testCase)}
                  onChange={(e) => {
                    const version = Number(e.target.value);
                    if (!Number.isInteger(version) || version < 1) return;
                    onUpdate({ version: version === 1 ? undefined : version });
                  }}
                />
              </div>
            </div>
          ) : null}
        </div>
      ) : null}
    </article>
  );
}

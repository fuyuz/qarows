import { useEffect, useState } from "react";
import type { TestCase, TestScenario } from "@qarows/shared";
import {
  Button,
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
import { ChevronDown, ChevronRight, ChevronUp, Plus, Trash2 } from "lucide-react";

export function DefinitionScenariosPanel({
  scenarios,
  testCases,
  onUpdate,
  onChangeId,
  onAdd,
  onRemove,
  className,
}: {
  scenarios: TestScenario[];
  testCases: TestCase[];
  onUpdate: (scenarioId: string, patch: Partial<Omit<TestScenario, "id">>) => void;
  onChangeId: (oldId: string, newId: string) => void;
  onAdd: (scenario: TestScenario) => void;
  onRemove: (scenarioId: string) => void;
  className?: string;
}) {
  const [open, setOpen] = useState(false);
  const [newId, setNewId] = useState("");
  const [newName, setNewName] = useState("");
  const [newStepId, setNewStepId] = useState("");
  const [idError, setIdError] = useState<string | null>(null);

  const testCaseIds = testCases.map((tc) => tc.id);
  const tcLabel = (id: string) => {
    const tc = testCases.find((entry) => entry.id === id);
    if (!tc) return id;
    const desc = tc.description.trim();
    return desc ? `${id} — ${desc}` : id;
  };

  const handleAdd = () => {
    const id = newId.trim();
    if (!id) {
      setIdError("ID を入力してください");
      return;
    }
    if (scenarios.some((s) => s.id === id)) {
      setIdError(`ID「${id}」は既に使われています`);
      return;
    }
    const stepId = newStepId.trim() || testCaseIds[0];
    if (!stepId) {
      setIdError("ステップに追加するテストケースがありません");
      return;
    }
    onAdd({
      id,
      name: newName.trim() || id,
      steps: [stepId],
    });
    setNewId("");
    setNewName("");
    setNewStepId("");
    setIdError(null);
  };

  const moveStep = (scenario: TestScenario, index: number, delta: number) => {
    const nextIndex = index + delta;
    if (nextIndex < 0 || nextIndex >= scenario.steps.length) return;
    const steps = [...scenario.steps];
    const [item] = steps.splice(index, 1);
    steps.splice(nextIndex, 0, item!);
    onUpdate(scenario.id, { steps });
  };

  const removeStep = (scenario: TestScenario, index: number) => {
    if (scenario.steps.length <= 1) return;
    onUpdate(scenario.id, { steps: scenario.steps.filter((_, i) => i !== index) });
  };

  const addStep = (scenario: TestScenario, stepId: string) => {
    if (!stepId) return;
    onUpdate(scenario.id, { steps: [...scenario.steps, stepId] });
  };

  return (
    <section className={cn("rounded-lg border border-border/80 bg-card/40", className)}>
      <button
        type="button"
        className="flex w-full items-center gap-2 px-4 py-3 text-left text-sm font-medium"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
      >
        {open ? <ChevronDown className="size-4 shrink-0" /> : <ChevronRight className="size-4 shrink-0" />}
        <span>シナリオ</span>
        <span className="text-xs font-normal text-muted-foreground">{scenarios.length} 件</span>
      </button>
      {open ? (
        <div className="space-y-4 border-t border-border/60 px-4 py-3">
          {scenarios.length === 0 ? (
            <p className="text-sm text-muted-foreground">シナリオはまだありません</p>
          ) : (
            scenarios.map((scenario) => (
              <ScenarioEditor
                key={scenario.id}
                scenario={scenario}
                siblingIds={scenarios.filter((s) => s.id !== scenario.id).map((s) => s.id)}
                testCaseIds={testCaseIds}
                tcLabel={tcLabel}
                onChangeId={onChangeId}
                onUpdate={onUpdate}
                onRemove={onRemove}
                onMoveStep={moveStep}
                onRemoveStep={removeStep}
                onAddStep={addStep}
              />
            ))
          )}

          <div className="space-y-2 border-t border-dashed border-border/60 pt-3">
            <p className="text-xs font-medium text-muted-foreground">シナリオを追加</p>
            <div className="flex flex-wrap items-end gap-2">
              <div className="grid min-w-[8rem] flex-1 gap-1">
                <Label className="text-xs text-muted-foreground" htmlFor="definition-scenario-new-id">
                  ID
                </Label>
                <Input
                  id="definition-scenario-new-id"
                  value={newId}
                  className={cn("h-8", idError && "animate-ui-shake")}
                  placeholder="smoke"
                  aria-invalid={idError != null}
                  onChange={(e) => {
                    setIdError(null);
                    setNewId(e.target.value);
                  }}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      e.preventDefault();
                      handleAdd();
                    }
                  }}
                />
              </div>
              <div className="grid min-w-[10rem] flex-[2] gap-1">
                <Label className="text-xs text-muted-foreground">名前</Label>
                <Input
                  value={newName}
                  className="h-8"
                  placeholder="スモーク"
                  onChange={(e) => setNewName(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      e.preventDefault();
                      handleAdd();
                    }
                  }}
                />
              </div>
              <div className="grid min-w-[12rem] flex-[2] gap-1">
                <Label className="text-xs text-muted-foreground">最初のステップ</Label>
                <Select
                  value={newStepId || testCaseIds[0] || ""}
                  onValueChange={setNewStepId}
                  disabled={testCaseIds.length === 0}
                >
                  <SelectTrigger className="h-8">
                    <SelectValue placeholder="テストケース" />
                  </SelectTrigger>
                  <SelectContent>
                    {testCaseIds.map((id) => (
                      <SelectItem key={id} value={id}>
                        {tcLabel(id)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <Button
                type="button"
                size="sm"
                variant="outline"
                className="h-8"
                onClick={handleAdd}
                disabled={!newId.trim() || testCaseIds.length === 0}
              >
                <Plus className="mr-1 size-3.5" />
                追加
              </Button>
            </div>
            {idError ? <p className="text-sm text-destructive">{idError}</p> : null}
          </div>
        </div>
      ) : null}
    </section>
  );
}

function ScenarioEditor({
  scenario,
  siblingIds,
  testCaseIds,
  tcLabel,
  onChangeId,
  onUpdate,
  onRemove,
  onMoveStep,
  onRemoveStep,
  onAddStep,
}: {
  scenario: TestScenario;
  siblingIds: string[];
  testCaseIds: string[];
  tcLabel: (id: string) => string;
  onChangeId: (oldId: string, newId: string) => void;
  onUpdate: (scenarioId: string, patch: Partial<Omit<TestScenario, "id">>) => void;
  onRemove: (scenarioId: string) => void;
  onMoveStep: (scenario: TestScenario, index: number, delta: number) => void;
  onRemoveStep: (scenario: TestScenario, index: number) => void;
  onAddStep: (scenario: TestScenario, stepId: string) => void;
}) {
  const [idDraft, setIdDraft] = useState(scenario.id);
  const [addStepId, setAddStepId] = useState("");
  const [idError, setIdError] = useState<string | null>(null);

  useEffect(() => {
    setIdDraft(scenario.id);
    setIdError(null);
  }, [scenario.id]);

  const commitId = () => {
    const next = idDraft.trim();
    if (!next || next === scenario.id) {
      setIdDraft(scenario.id);
      setIdError(null);
      return;
    }
    if (siblingIds.includes(next)) {
      setIdError(`ID「${next}」は既に使われています`);
      setIdDraft(scenario.id);
      return;
    }
    setIdError(null);
    onChangeId(scenario.id, next);
  };

  const availableToAdd = testCaseIds.filter((id) => !scenario.steps.includes(id));
  const pickId = addStepId || availableToAdd[0] || testCaseIds[0] || "";

  return (
    <div className="space-y-3 rounded-md border border-border/70 bg-background/60 p-3">
      <div className="flex flex-wrap items-end gap-2">
        <div className="grid min-w-[8rem] flex-1 gap-1">
          <Label className="text-xs text-muted-foreground">ID</Label>
          <Input
            value={idDraft}
            className={cn("h-8 font-mono text-xs", idError && "animate-ui-shake")}
            aria-invalid={idError != null}
            onChange={(e) => {
              setIdError(null);
              setIdDraft(e.target.value);
            }}
            onBlur={commitId}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                (e.target as HTMLInputElement).blur();
              }
            }}
          />
          {idError ? <p className="text-xs text-destructive">{idError}</p> : null}
        </div>
        <div className="grid min-w-[10rem] flex-[2] gap-1">
          <Label className="text-xs text-muted-foreground">名前</Label>
          <Input
            value={scenario.name}
            className="h-8"
            onChange={(e) => onUpdate(scenario.id, { name: e.target.value })}
          />
        </div>
        <Button
          type="button"
          size="icon"
          variant="ghost"
          className="size-8 shrink-0 text-muted-foreground"
          onClick={() => {
            if (window.confirm(`シナリオ「${scenario.name}」を削除しますか？`)) {
              onRemove(scenario.id);
            }
          }}
          aria-label={`${scenario.name} を削除`}
        >
          <Trash2 className="size-4" />
        </Button>
      </div>

      <div className="grid gap-1">
        <Label className="text-xs text-muted-foreground">説明（任意）</Label>
        <Textarea
          value={scenario.description ?? ""}
          className="min-h-[4rem] text-sm"
          placeholder="このシナリオの目的"
          onChange={(e) =>
            onUpdate(scenario.id, {
              description: e.target.value.length > 0 ? e.target.value : undefined,
            })
          }
        />
      </div>

      <div className="space-y-2">
        <Label className="text-xs text-muted-foreground">ステップ（テストケース ID）</Label>
        <ol className="space-y-1.5">
          {scenario.steps.map((stepId, index) => {
            const missing = !testCaseIds.includes(stepId);
            return (
              <li
                key={`${scenario.id}-${index}-${stepId}`}
                className="flex items-center gap-1 rounded-md border border-border/50 bg-muted/20 px-2 py-1"
              >
                <span className="w-5 shrink-0 text-center text-xs text-muted-foreground">
                  {index + 1}
                </span>
                <span
                  className={cn(
                    "min-w-0 flex-1 truncate text-sm",
                    missing && "text-destructive",
                  )}
                  title={missing ? `未知の ID: ${stepId}` : tcLabel(stepId)}
                >
                  {missing ? `${stepId}（未定義）` : tcLabel(stepId)}
                </span>
                <Button
                  type="button"
                  size="icon"
                  variant="ghost"
                  className="size-7 shrink-0"
                  disabled={index === 0}
                  onClick={() => onMoveStep(scenario, index, -1)}
                  aria-label="上へ"
                >
                  <ChevronUp className="size-3.5" />
                </Button>
                <Button
                  type="button"
                  size="icon"
                  variant="ghost"
                  className="size-7 shrink-0"
                  disabled={index >= scenario.steps.length - 1}
                  onClick={() => onMoveStep(scenario, index, 1)}
                  aria-label="下へ"
                >
                  <ChevronDown className="size-3.5" />
                </Button>
                <Button
                  type="button"
                  size="icon"
                  variant="ghost"
                  className="size-7 shrink-0 text-muted-foreground"
                  disabled={scenario.steps.length <= 1}
                  onClick={() => onRemoveStep(scenario, index)}
                  aria-label="ステップを削除"
                >
                  <Trash2 className="size-3.5" />
                </Button>
              </li>
            );
          })}
        </ol>

        <div className="flex flex-wrap items-center gap-2">
          <Select
            value={pickId}
            onValueChange={setAddStepId}
            disabled={testCaseIds.length === 0}
          >
            <SelectTrigger className="h-8 min-w-[12rem] flex-1">
              <SelectValue placeholder="テストケースを追加" />
            </SelectTrigger>
            <SelectContent>
              {(availableToAdd.length > 0 ? availableToAdd : testCaseIds).map((id) => (
                <SelectItem key={id} value={id}>
                  {tcLabel(id)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button
            type="button"
            size="sm"
            variant="outline"
            className="h-8"
            disabled={!pickId}
            onClick={() => {
              onAddStep(scenario, pickId);
              setAddStepId("");
            }}
          >
            <Plus className="mr-1 size-3.5" />
            ステップ追加
          </Button>
        </div>
      </div>
    </div>
  );
}

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  computeDefinitionDiff,
  definitionDiffSummary,
  type Environment,
  type TestCase,
  type TestDefinition,
  type TestScenario,
  type TargetEnvironmentSpec,
} from "@qarows/shared";
import { useTranslation } from "@qarows/ui";

function mapScenarioSteps(
  scenarios: TestScenario[] | undefined,
  mapStep: (stepId: string) => string | null,
): TestScenario[] | undefined {
  if (!scenarios?.length) return scenarios;
  const next = scenarios
    .map((scenario) => {
      const steps = scenario.steps
        .map(mapStep)
        .filter((stepId): stepId is string => stepId != null);
      if (steps.length === 0) return null;
      return { ...scenario, steps };
    })
    .filter((scenario): scenario is TestScenario => scenario != null);
  return next.length > 0 ? next : undefined;
}

function cloneDefinition(definition: TestDefinition): TestDefinition {
  return structuredClone(definition);
}

function nextTestCaseId(testCases: TestCase[]): string {
  let max = 0;
  for (const tc of testCases) {
    const match = /^TC-(\d+)$/i.exec(tc.id);
    if (match) max = Math.max(max, Number(match[1]));
  }
  return `TC-${String(max + 1).padStart(3, "0")}`;
}

function projectKey(definition: TestDefinition): string {
  return definition.project.id ?? definition.project.name;
}

/**
 * draft を保存済み定義で再読み込みするか。
 * - プロジェクトが変わったら必ず読み直す
 * - 未保存の編集がなければ、リモートの定義変更（syncKey の移動、または
 *   ランナー側 updateTestCase のように generation を動かさない変更）に追従する
 * - 未保存の編集があるときは捨てない。draft を読み込んだ世代を Apply に送るので
 *   server が 409 を返し、そこでユーザーに判断させる
 */
export function shouldReloadDraft(input: {
  projectChanged: boolean;
  syncChanged: boolean;
  definitionChanged: boolean;
  loaded: boolean;
  hasChanges: boolean;
}): boolean {
  if (!input.loaded || input.projectChanged) return true;
  if (input.hasChanges) return false;
  return input.syncChanged || input.definitionChanged;
}

export function useDefinitionDraft(
  savedDefinition: TestDefinition | null,
  options?: { syncKey?: string | number | null },
) {
  const { t } = useTranslation();
  const [baseline, setBaseline] = useState<TestDefinition | null>(null);
  const [draft, setDraft] = useState<TestDefinition | null>(null);
  const loadedKeyRef = useRef<string | null>(null);
  /** 直近に観測した syncKey。読み込んだ世代とは別に持つ */
  const seenSyncKeyRef = useRef<string | number | null | undefined>(undefined);
  /** baseline を読み込んだときの syncKey。Apply の expectedGeneration に使う */
  const [baseSyncKey, setBaseSyncKey] = useState<string | number | null | undefined>(undefined);
  const loadedDefinitionRef = useRef<TestDefinition | null>(null);
  /** 未保存の編集を remote 更新で消さないための判定用（effect から state を読まない） */
  const hasChangesRef = useRef(false);
  const syncKey = options?.syncKey;

  useEffect(() => {
    if (!savedDefinition) {
      setBaseline(null);
      setDraft(null);
      loadedKeyRef.current = null;
      seenSyncKeyRef.current = undefined;
      loadedDefinitionRef.current = null;
      setBaseSyncKey(undefined);
      return;
    }
    const key = projectKey(savedDefinition);
    const projectChanged = loadedKeyRef.current !== key;
    const syncChanged =
      syncKey !== undefined &&
      seenSyncKeyRef.current !== undefined &&
      seenSyncKeyRef.current !== syncKey;
    const definitionChanged =
      loadedDefinitionRef.current != null && loadedDefinitionRef.current !== savedDefinition;

    seenSyncKeyRef.current = syncKey;

    if (
      !shouldReloadDraft({
        projectChanged,
        syncChanged,
        definitionChanged,
        loaded: loadedKeyRef.current != null,
        hasChanges: hasChangesRef.current,
      })
    ) {
      return;
    }

    loadedKeyRef.current = key;
    loadedDefinitionRef.current = savedDefinition;
    setBaseSyncKey(syncKey);
    setBaseline(cloneDefinition(savedDefinition));
    setDraft(cloneDefinition(savedDefinition));
  }, [savedDefinition, syncKey]);

  const diff = useMemo(() => {
    if (!baseline || !draft) return null;
    return computeDefinitionDiff(baseline, draft);
  }, [baseline, draft]);

  const hasChanges = diff?.hasChanges ?? false;
  hasChangesRef.current = hasChanges;
  const changeSummary = diff ? definitionDiffSummary(diff, t) : "";

  /** 編集を捨てる。リモートが進んでいれば baseline ごと最新に戻す */
  const discard = useCallback(() => {
    const latest = savedDefinition ?? baseline;
    if (!latest) return;
    loadedDefinitionRef.current = savedDefinition;
    setBaseSyncKey(syncKey);
    setBaseline(cloneDefinition(latest));
    setDraft(cloneDefinition(latest));
  }, [baseline, savedDefinition, syncKey]);

  const markApplied = useCallback((applied: TestDefinition) => {
    const next = cloneDefinition(applied);
    setBaseline(next);
    setDraft(cloneDefinition(next));
  }, []);

  /** Apply 後は次の snapshot を新しい baseline として受け入れる */
  const rebaseOnNextSnapshot = useCallback(() => {
    loadedDefinitionRef.current = null;
  }, []);

  /** Replace draft contents while keeping baseline (shows as pending changes). */
  const replaceDraft = useCallback((next: TestDefinition) => {
    setDraft(cloneDefinition(next));
  }, []);

  const updateTestCase = useCallback((testCaseId: string, patch: Partial<TestCase>) => {
    setDraft((prev) => {
      if (!prev) return prev;
      return {
        ...prev,
        testCases: prev.testCases.map((tc) =>
          tc.id === testCaseId ? { ...tc, ...patch, id: tc.id } : tc,
        ),
      };
    });
  }, []);

  const setTestCaseId = useCallback((oldId: string, newId: string) => {
    const trimmed = newId.trim();
    if (!trimmed) return;
    setDraft((prev) => {
      if (!prev) return prev;
      if (prev.testCases.some((tc) => tc.id === trimmed && tc.id !== oldId)) return prev;
      return {
        ...prev,
        testCases: prev.testCases.map((tc) => (tc.id === oldId ? { ...tc, id: trimmed } : tc)),
        scenarios: mapScenarioSteps(prev.scenarios, (stepId) =>
          stepId === oldId ? trimmed : stepId,
        ),
      };
    });
  }, []);

  const addTestCase = useCallback((seed?: Partial<TestCase>) => {
    setDraft((prev) => {
      if (!prev) return prev;
      const id = seed?.id?.trim() || nextTestCaseId(prev.testCases);
      if (prev.testCases.some((tc) => tc.id === id)) return prev;
      const next: TestCase = {
        id,
        category: seed?.category ?? { major: "未分類" },
        description: seed?.description ?? "",
        ...(seed?.prerequisites ? { prerequisites: seed.prerequisites } : {}),
        ...(seed?.version != null ? { version: seed.version } : {}),
        ...(seed?.targetEnvironments ? { targetEnvironments: seed.targetEnvironments } : {}),
      };
      return { ...prev, testCases: [...prev.testCases, next] };
    });
  }, []);

  const removeTestCase = useCallback((testCaseId: string) => {
    setDraft((prev) => {
      if (!prev) return prev;
      return {
        ...prev,
        testCases: prev.testCases.filter((tc) => tc.id !== testCaseId),
        scenarios: mapScenarioSteps(prev.scenarios, (stepId) =>
          stepId === testCaseId ? null : stepId,
        ),
      };
    });
  }, []);

  const updateEnvironment = useCallback((envId: string, patch: Partial<Environment>) => {
    setDraft((prev) => {
      if (!prev) return prev;
      return {
        ...prev,
        environments: prev.environments.map((env) =>
          env.id === envId ? { ...env, ...patch, id: env.id } : env,
        ),
      };
    });
  }, []);

  const addEnvironment = useCallback((env: Environment) => {
    const id = env.id.trim();
    const name = env.name.trim() || id;
    if (!id) return;
    setDraft((prev) => {
      if (!prev) return prev;
      if (prev.environments.some((e) => e.id === id)) return prev;
      return { ...prev, environments: [...prev.environments, { id, name }] };
    });
  }, []);

  const removeEnvironment = useCallback((envId: string) => {
    setDraft((prev) => {
      if (!prev) return prev;
      if (prev.environments.length <= 1) return prev;
      return {
        ...prev,
        environments: prev.environments.filter((env) => env.id !== envId),
        testCases: prev.testCases.map((tc) => {
          const targets = tc.targetEnvironments?.targets;
          if (!targets?.includes(envId)) return tc;
          const nextTargets = targets.filter((id) => id !== envId);
          if (nextTargets.length === 0) {
            const { targetEnvironments: _, ...rest } = tc;
            return rest;
          }
          return {
            ...tc,
            targetEnvironments: {
              required: tc.targetEnvironments!.required,
              targets: nextTargets,
            },
          };
        }),
      };
    });
  }, []);

  const updateScenario = useCallback(
    (scenarioId: string, patch: Partial<Omit<TestScenario, "id">>) => {
      setDraft((prev) => {
        if (!prev?.scenarios) return prev;
        return {
          ...prev,
          scenarios: prev.scenarios.map((scenario) => {
            if (scenario.id !== scenarioId) return scenario;
            const next: TestScenario = { ...scenario, ...patch, id: scenario.id };
            if (patch.steps) {
              const steps = patch.steps.map((s) => s.trim()).filter(Boolean);
              if (steps.length === 0) return scenario;
              next.steps = steps;
            }
            if (patch.name != null) next.name = patch.name;
            if ("description" in patch) {
              if (patch.description) next.description = patch.description;
              else delete next.description;
            }
            return next;
          }),
        };
      });
    },
    [],
  );

  const setScenarioId = useCallback((oldId: string, newId: string) => {
    const trimmed = newId.trim();
    if (!trimmed) return;
    setDraft((prev) => {
      if (!prev?.scenarios) return prev;
      if (prev.scenarios.some((s) => s.id === trimmed && s.id !== oldId)) return prev;
      return {
        ...prev,
        scenarios: prev.scenarios.map((s) => (s.id === oldId ? { ...s, id: trimmed } : s)),
      };
    });
  }, []);

  const addScenario = useCallback((scenario: TestScenario) => {
    const id = scenario.id.trim();
    const name = scenario.name.trim() || id;
    const steps = scenario.steps.map((s) => s.trim()).filter(Boolean);
    if (!id || steps.length === 0) return;
    setDraft((prev) => {
      if (!prev) return prev;
      if (prev.scenarios?.some((s) => s.id === id)) return prev;
      const next: TestScenario = {
        id,
        name,
        steps,
        ...(scenario.description?.trim()
          ? { description: scenario.description.trim() }
          : {}),
      };
      return { ...prev, scenarios: [...(prev.scenarios ?? []), next] };
    });
  }, []);

  const removeScenario = useCallback((scenarioId: string) => {
    setDraft((prev) => {
      if (!prev?.scenarios) return prev;
      const scenarios = prev.scenarios.filter((s) => s.id !== scenarioId);
      if (scenarios.length === 0) {
        const { scenarios: _, ...rest } = prev;
        return rest;
      }
      return { ...prev, scenarios };
    });
  }, []);

  const setTestCaseTargets = useCallback(
    (testCaseId: string, spec: TargetEnvironmentSpec | undefined) => {
      setDraft((prev) => {
        if (!prev) return prev;
        return {
          ...prev,
          testCases: prev.testCases.map((tc) => {
            if (tc.id !== testCaseId) return tc;
            if (!spec) {
              const { targetEnvironments: _, ...rest } = tc;
              return rest;
            }
            return { ...tc, targetEnvironments: spec };
          }),
        };
      });
    },
    [],
  );

  const isTestCaseModified = useCallback(
    (testCaseId: string) => {
      if (!diff) return false;
      return (
        diff.testCases.added.some((tc) => tc.id === testCaseId) ||
        diff.testCases.modified.some((tc) => tc.id === testCaseId)
      );
    },
    [diff],
  );

  const isTestCaseNew = useCallback(
    (testCaseId: string) => {
      if (!diff) return false;
      return diff.testCases.added.some((tc) => tc.id === testCaseId);
    },
    [diff],
  );

  return {
    baseline,
    draft,
    /** baseline を読み込んだ syncKey（Team 版 generation） */
    baseSyncKey,
    rebaseOnNextSnapshot,
    diff,
    hasChanges,
    changeSummary,
    discard,
    markApplied,
    replaceDraft,
    updateTestCase,
    setTestCaseId,
    addTestCase,
    removeTestCase,
    updateEnvironment,
    addEnvironment,
    removeEnvironment,
    updateScenario,
    setScenarioId,
    addScenario,
    removeScenario,
    setTestCaseTargets,
    isTestCaseModified,
    isTestCaseNew,
  };
}

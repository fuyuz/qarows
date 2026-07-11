import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  computeDefinitionDiff,
  definitionDiffSummary,
  type Environment,
  type TestCase,
  type TestDefinition,
  type TargetEnvironmentSpec,
} from "@qarows/shared";

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

export function useDefinitionDraft(savedDefinition: TestDefinition | null) {
  const [baseline, setBaseline] = useState<TestDefinition | null>(null);
  const [draft, setDraft] = useState<TestDefinition | null>(null);
  const loadedKeyRef = useRef<string | null>(null);

  useEffect(() => {
    if (!savedDefinition) {
      setBaseline(null);
      setDraft(null);
      loadedKeyRef.current = null;
      return;
    }
    const key = projectKey(savedDefinition);
    if (loadedKeyRef.current === key) return;
    loadedKeyRef.current = key;
    setBaseline(cloneDefinition(savedDefinition));
    setDraft(cloneDefinition(savedDefinition));
  }, [savedDefinition]);

  const diff = useMemo(() => {
    if (!baseline || !draft) return null;
    return computeDefinitionDiff(baseline, draft);
  }, [baseline, draft]);

  const hasChanges = diff?.hasChanges ?? false;
  const changeSummary = diff ? definitionDiffSummary(diff) : "";

  const discard = useCallback(() => {
    if (!baseline) return;
    setDraft(cloneDefinition(baseline));
  }, [baseline]);

  const markApplied = useCallback((applied: TestDefinition) => {
    const next = cloneDefinition(applied);
    setBaseline(next);
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
    diff,
    hasChanges,
    changeSummary,
    discard,
    markApplied,
    updateTestCase,
    setTestCaseId,
    addTestCase,
    removeTestCase,
    updateEnvironment,
    addEnvironment,
    removeEnvironment,
    setTestCaseTargets,
    isTestCaseModified,
    isTestCaseNew,
  };
}

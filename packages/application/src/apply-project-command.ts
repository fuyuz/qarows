import {
  clearTestCaseEnvironmentResult,
  createEmptyResults,
  getTestCaseVersion,
  mergeResultsFiles,
  validateSession,
} from "@qarows/shared";
import type {
  ApplyProjectCommandOptions,
  ApplyProjectCommandResult,
  ProjectCommand,
} from "./project-command";
import type { ProjectSnapshot } from "./types";
import { validateProjectCommand } from "./validate-project-command";

function stampResultVersion(
  snapshot: ProjectSnapshot,
  testCaseId: string,
  entry: import("@qarows/shared").TestResultEntry,
): import("@qarows/shared").TestResultEntry {
  const testCase = snapshot.definition.testCases.find((tc) => tc.id === testCaseId);
  if (!testCase) return entry;
  const version = getTestCaseVersion(testCase);
  return version > 1 ? { ...entry, version } : entry;
}

function withUpdatedResults(
  snapshot: ProjectSnapshot,
  results: ProjectSnapshot["results"],
  now: string,
): ProjectSnapshot {
  return {
    ...snapshot,
    updatedAt: now,
    results: { ...results, updatedAt: now },
  };
}

/** 純粋関数: Command を Snapshot に適用 */
export function applyProjectCommand(
  snapshot: ProjectSnapshot,
  command: ProjectCommand,
  options: ApplyProjectCommandOptions = {},
): ApplyProjectCommandResult {
  const now = options.now ?? new Date().toISOString();
  validateProjectCommand(snapshot, command);

  switch (command.type) {
    case "setSession": {
      validateSession(command.session);
      return {
        snapshot: { ...snapshot, session: command.session, updatedAt: now },
        affectedTestCaseId: null,
      };
    }

    case "updateResult": {
      const stamped = stampResultVersion(snapshot, command.testCaseId, command.entry);
      const next = withUpdatedResults(snapshot, {
        ...snapshot.results,
        results: {
          ...snapshot.results.results,
          [command.testCaseId]: {
            ...(snapshot.results.results[command.testCaseId] ?? {}),
            [command.envId]: stamped,
          },
        },
      }, now);
      return { snapshot: next, affectedTestCaseId: command.testCaseId };
    }

    case "updateResultsBatch": {
      const session = snapshot.session;
      if (!session) {
        throw new Error("セッションが開始されていません");
      }
      const testCase = snapshot.definition.testCases.find((tc) => tc.id === command.testCaseId);
      const version = testCase ? getTestCaseVersion(testCase) : 1;
      const caseResults = { ...(snapshot.results.results[command.testCaseId] ?? {}) };
      for (const envId of command.envIds) {
        caseResults[envId] = {
          status: command.partial.status,
          memo: command.partial.memo ?? caseResults[envId]?.memo,
          executedAt: now,
          executedBy: session.executorName,
          ...(version > 1 ? { version } : {}),
        };
      }
      const next = withUpdatedResults(snapshot, {
        ...snapshot.results,
        results: {
          ...snapshot.results.results,
          [command.testCaseId]: caseResults,
        },
      }, now);
      return { snapshot: next, affectedTestCaseId: command.testCaseId };
    }

    case "clearTestResult": {
      const cleared = clearTestCaseEnvironmentResult(
        snapshot.results,
        command.testCaseId,
        command.envId,
      );
      if (cleared === snapshot.results) {
        return { snapshot, affectedTestCaseId: null };
      }
      return {
        snapshot: withUpdatedResults(snapshot, cleared, now),
        affectedTestCaseId: command.testCaseId,
      };
    }

    case "clearResults": {
      return {
        snapshot: {
          ...snapshot,
          session: null,
          updatedAt: now,
          results: createEmptyResults(snapshot.id),
        },
        affectedTestCaseId: null,
      };
    }

    case "updateTestCase": {
      const nextDefinition = {
        ...snapshot.definition,
        testCases: snapshot.definition.testCases.map((tc) =>
          tc.id === command.testCaseId ? { ...tc, ...command.patch } : tc,
        ),
      };
      return {
        snapshot: {
          ...snapshot,
          definition: nextDefinition,
          updatedAt: now,
        },
        affectedTestCaseId: command.testCaseId,
      };
    }

    case "addBug": {
      const next = withUpdatedResults(snapshot, {
        ...snapshot.results,
        bugs: [...snapshot.results.bugs, command.bug],
      }, now);
      return { snapshot: next, affectedTestCaseId: command.bug.testCaseId ?? null };
    }

    case "updateBug": {
      const next = withUpdatedResults(snapshot, {
        ...snapshot.results,
        bugs: snapshot.results.bugs.map((bug) =>
          bug.id === command.bug.id ? command.bug : bug,
        ),
      }, now);
      return { snapshot: next, affectedTestCaseId: command.bug.testCaseId ?? null };
    }

    case "mergeResults": {
      const merged = mergeResultsFiles(snapshot.results, command.incoming);
      return {
        snapshot: withUpdatedResults(snapshot, merged, now),
        affectedTestCaseId: null,
      };
    }

    case "replaceSnapshot": {
      return {
        snapshot: {
          ...snapshot,
          definition: command.definition,
          results: command.results,
          session: command.session,
          updatedAt: now,
        },
        affectedTestCaseId: null,
      };
    }

    default: {
      const _exhaustive: never = command;
      throw new Error(`Unknown command: ${(_exhaustive as ProjectCommand).type}`);
    }
  }
}

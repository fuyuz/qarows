import type { Bug, TestDefinition, TestResultEntry } from "@qarows/shared";
import type { ProjectCommand } from "./project-command";
import type { ProjectSnapshot } from "./types";

export class ProjectCommandValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ProjectCommandValidationError";
  }
}

function fail(message: string): never {
  throw new ProjectCommandValidationError(message);
}

function environmentIds(definition: TestDefinition): Set<string> {
  return new Set(definition.environments.map((env) => env.id));
}

function testCaseIds(definition: TestDefinition): Set<string> {
  return new Set(definition.testCases.map((tc) => tc.id));
}

function assertKnownTestCase(definition: TestDefinition, testCaseId: string): void {
  if (!testCaseIds(definition).has(testCaseId)) {
    fail(`Unknown testCaseId: ${testCaseId}`);
  }
}

function assertKnownEnvironment(definition: TestDefinition, envId: string): void {
  if (!environmentIds(definition).has(envId)) {
    fail(`Unknown envId: ${envId}`);
  }
}

function assertKnownEnvironments(definition: TestDefinition, envIds: string[]): void {
  for (const envId of envIds) {
    assertKnownEnvironment(definition, envId);
  }
}

function assertVersionAtLeast(version: number, label: string): void {
  if (!Number.isInteger(version) || version < 1) {
    fail(`${label} must be an integer >= 1`);
  }
}

export function isValidIsoDateTime(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}T/.test(value)) return false;
  return !Number.isNaN(Date.parse(value));
}

function assertResultEntry(entry: TestResultEntry): void {
  if (entry.version !== undefined) {
    assertVersionAtLeast(entry.version, "entry.version");
  }
  if (entry.executedAt !== undefined && !isValidIsoDateTime(entry.executedAt)) {
    fail("entry.executedAt must be a valid ISO-8601 datetime");
  }
}

function assertBugReferences(definition: TestDefinition, bug: Bug): void {
  if (bug.testCaseId !== undefined) {
    assertKnownTestCase(definition, bug.testCaseId);
  }
  if (bug.environmentIds !== undefined) {
    assertKnownEnvironments(definition, bug.environmentIds);
  }
}

/** Snapshot に対する command の参照整合性を検証する */
export function validateProjectCommand(snapshot: ProjectSnapshot, command: ProjectCommand): void {
  const { definition } = snapshot;

  switch (command.type) {
    case "setSession":
      assertKnownEnvironments(definition, command.session.selectedEnvironmentIds);
      return;

    case "updateResult":
      assertKnownTestCase(definition, command.testCaseId);
      assertKnownEnvironment(definition, command.envId);
      assertResultEntry(command.entry);
      return;

    case "updateResultsBatch":
      assertKnownTestCase(definition, command.testCaseId);
      assertKnownEnvironments(definition, command.envIds);
      return;

    case "clearTestResult":
      assertKnownTestCase(definition, command.testCaseId);
      assertKnownEnvironment(definition, command.envId);
      return;

    case "updateTestCase": {
      assertKnownTestCase(definition, command.testCaseId);
      if (command.patch.version !== undefined) {
        assertVersionAtLeast(command.patch.version, "patch.version");
      }
      return;
    }

    case "addBug":
      if (snapshot.results.bugs.some((bug) => bug.id === command.bug.id)) {
        fail(`Bug id already exists: ${command.bug.id}`);
      }
      assertBugReferences(definition, command.bug);
      return;

    case "updateBug":
      if (!snapshot.results.bugs.some((bug) => bug.id === command.bug.id)) {
        fail(`Unknown bug id: ${command.bug.id}`);
      }
      assertBugReferences(definition, command.bug);
      return;

    case "clearResults":
    case "mergeResults":
    case "replaceSnapshot":
      return;

    default: {
      const _exhaustive: never = command;
      fail(`Unknown command: ${(_exhaustive as ProjectCommand).type}`);
    }
  }
}

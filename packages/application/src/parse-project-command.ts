import type { ProjectCommand } from "./project-command";
import { isValidIsoDateTime } from "./validate-project-command";

const MAX_ID_LENGTH = 128;
const MAX_SHORT_TEXT = 512;
const MAX_TEXT = 8192;
const MAX_ENV_IDS = 64;
const MAX_ENVIRONMENT_IDS = 64;

const ALL_COMMAND_TYPES = new Set<ProjectCommand["type"]>([
  "setSession",
  "updateResult",
  "updateResultsBatch",
  "clearTestResult",
  "clearResults",
  "updateTestCase",
  "addBug",
  "updateBug",
  "mergeResults",
  "replaceSnapshot",
]);

/** WebSocket クライアントから受理するコマンド（破壊的操作・一括取込は HTTP/Worker RPC のみ） */
const CLIENT_COMMAND_TYPES = new Set<ProjectCommand["type"]>([
  "setSession",
  "updateResult",
  "updateResultsBatch",
  "clearTestResult",
  "updateTestCase",
  "addBug",
  "updateBug",
]);

const TEST_STATUSES = new Set(["OK", "SKIP", "NG"]);
const BUG_STATUSES = new Set([
  "open",
  "in_progress",
  "fixed",
  "resolved",
  "wont_fix",
]);
const BUG_SEVERITIES = new Set(["low", "medium", "high", "critical"]);

function isRecord(value: unknown): value is Record<string, unknown> {
  return value != null && typeof value === "object";
}

function isNonEmptyString(value: unknown, maxLength: number): value is string {
  return typeof value === "string" && value.length > 0 && value.length <= maxLength;
}

function isOptionalString(value: unknown, maxLength: number): boolean {
  return value === undefined || (typeof value === "string" && value.length <= maxLength);
}

function isStringArray(value: unknown, maxItems: number, maxItemLength: number): value is string[] {
  return (
    Array.isArray(value) &&
    value.length > 0 &&
    value.length <= maxItems &&
    value.every((item) => typeof item === "string" && item.length > 0 && item.length <= maxItemLength)
  );
}

function parseSession(value: unknown): ProjectCommand | null {
  if (!isRecord(value)) return null;
  const executorName = typeof value.executorName === "string" ? value.executorName : "";
  const selectedEnvironmentIds = value.selectedEnvironmentIds;
  if (!isStringArray(selectedEnvironmentIds, MAX_ENVIRONMENT_IDS, MAX_ID_LENGTH)) return null;
  return {
    type: "setSession",
    session: { executorName, selectedEnvironmentIds },
  };
}

function parseTestResultEntry(value: unknown): import("@qarows/shared").TestResultEntry | null {
  if (!isRecord(value)) return null;
  if (typeof value.status !== "string" || !TEST_STATUSES.has(value.status)) return null;
  if (!isOptionalString(value.executedAt, MAX_SHORT_TEXT)) return null;
  if (!isOptionalString(value.executedBy, MAX_SHORT_TEXT)) return null;
  if (!isOptionalString(value.memo, MAX_TEXT)) return null;
  if (
    value.version !== undefined &&
    (typeof value.version !== "number" || !Number.isInteger(value.version) || value.version < 1)
  ) {
    return null;
  }
  if (typeof value.executedAt === "string" && !isValidIsoDateTime(value.executedAt)) {
    return null;
  }
  return {
    status: value.status as "OK" | "SKIP" | "NG",
    ...(value.version !== undefined ? { version: value.version } : {}),
    ...(typeof value.executedAt === "string" ? { executedAt: value.executedAt } : {}),
    ...(typeof value.executedBy === "string" ? { executedBy: value.executedBy } : {}),
    ...(typeof value.memo === "string" ? { memo: value.memo } : {}),
  };
}

function parseBug(value: unknown): import("@qarows/shared").Bug | null {
  if (!isRecord(value)) return null;
  if (!isNonEmptyString(value.id, MAX_ID_LENGTH)) return null;
  if (!isNonEmptyString(value.title, MAX_TEXT)) return null;
  if (typeof value.severity !== "string" || !BUG_SEVERITIES.has(value.severity)) return null;
  if (typeof value.status !== "string" || !BUG_STATUSES.has(value.status)) return null;
  if (!isOptionalString(value.testCaseId, MAX_ID_LENGTH)) return null;
  if (!isOptionalString(value.assignee, MAX_SHORT_TEXT)) return null;
  if (!isOptionalString(value.steps, MAX_TEXT)) return null;
  if (!isOptionalString(value.expected, MAX_TEXT)) return null;
  if (!isOptionalString(value.actual, MAX_TEXT)) return null;
  if (!isOptionalString(value.fixNote, MAX_TEXT)) return null;
  if (!isOptionalString(value.memo, MAX_TEXT)) return null;
  if (value.environmentIds !== undefined) {
    if (!isStringArray(value.environmentIds, MAX_ENV_IDS, MAX_ID_LENGTH)) return null;
  }
  return {
    id: value.id,
    title: value.title,
    severity: value.severity as import("@qarows/shared").Bug["severity"],
    status: value.status as import("@qarows/shared").Bug["status"],
    ...(typeof value.testCaseId === "string" ? { testCaseId: value.testCaseId } : {}),
    ...(typeof value.assignee === "string" ? { assignee: value.assignee } : {}),
    ...(Array.isArray(value.environmentIds) ? { environmentIds: value.environmentIds } : {}),
    ...(typeof value.steps === "string" ? { steps: value.steps } : {}),
    ...(typeof value.expected === "string" ? { expected: value.expected } : {}),
    ...(typeof value.actual === "string" ? { actual: value.actual } : {}),
    ...(typeof value.fixNote === "string" ? { fixNote: value.fixNote } : {}),
    ...(typeof value.memo === "string" ? { memo: value.memo } : {}),
  };
}

function parseTestCasePatch(
  value: unknown,
): Partial<Pick<import("@qarows/shared").TestCase, "category" | "prerequisites" | "description" | "version">> | null {
  if (!isRecord(value)) return null;
  const patch: Partial<
    Pick<import("@qarows/shared").TestCase, "category" | "prerequisites" | "description" | "version">
  > = {};
  if (value.description !== undefined) {
    if (typeof value.description !== "string" || value.description.length > MAX_TEXT) return null;
    patch.description = value.description;
  }
  if (value.prerequisites !== undefined) {
    if (typeof value.prerequisites !== "string" || value.prerequisites.length > MAX_TEXT) return null;
    patch.prerequisites = value.prerequisites;
  }
  if (value.version !== undefined) {
    if (typeof value.version !== "number" || !Number.isInteger(value.version) || value.version < 1) {
      return null;
    }
    patch.version = value.version;
  }
  if (value.category !== undefined) {
    if (!isRecord(value.category)) return null;
    if (!isNonEmptyString(value.category.major, MAX_SHORT_TEXT)) return null;
    const category: import("@qarows/shared").TestCase["category"] = {
      major: value.category.major,
    };
    if (value.category.medium !== undefined) {
      if (typeof value.category.medium !== "string" || value.category.medium.length > MAX_SHORT_TEXT) {
        return null;
      }
      category.medium = value.category.medium;
    }
    if (value.category.minor !== undefined) {
      if (typeof value.category.minor !== "string" || value.category.minor.length > MAX_SHORT_TEXT) {
        return null;
      }
      category.minor = value.category.minor;
    }
    patch.category = category;
  }
  if (Object.keys(patch).length === 0) return null;
  return patch;
}

function parseCommandBody(value: unknown, allowedTypes: Set<ProjectCommand["type"]>): ProjectCommand | null {
  if (!isRecord(value) || typeof value.type !== "string") return null;
  if (!allowedTypes.has(value.type as ProjectCommand["type"])) return null;

  switch (value.type) {
    case "setSession":
      return parseSession(value.session);
    case "updateResult": {
      if (!isNonEmptyString(value.testCaseId, MAX_ID_LENGTH)) return null;
      if (!isNonEmptyString(value.envId, MAX_ID_LENGTH)) return null;
      const entry = parseTestResultEntry(value.entry);
      return entry
        ? { type: "updateResult", testCaseId: value.testCaseId, envId: value.envId, entry }
        : null;
    }
    case "updateResultsBatch": {
      if (!isNonEmptyString(value.testCaseId, MAX_ID_LENGTH)) return null;
      if (!isStringArray(value.envIds, MAX_ENV_IDS, MAX_ID_LENGTH)) return null;
      if (!isRecord(value.partial)) return null;
      if (typeof value.partial.status !== "string" || !TEST_STATUSES.has(value.partial.status)) return null;
      if (!isOptionalString(value.partial.memo, MAX_TEXT)) return null;
      return {
        type: "updateResultsBatch",
        testCaseId: value.testCaseId,
        envIds: value.envIds,
        partial: {
          status: value.partial.status as "OK" | "SKIP" | "NG",
          ...(typeof value.partial.memo === "string" ? { memo: value.partial.memo } : {}),
        },
      };
    }
    case "clearTestResult":
      if (!isNonEmptyString(value.testCaseId, MAX_ID_LENGTH)) return null;
      if (!isNonEmptyString(value.envId, MAX_ID_LENGTH)) return null;
      return { type: "clearTestResult", testCaseId: value.testCaseId, envId: value.envId };
    case "clearResults":
      return { type: "clearResults" };
    case "updateTestCase": {
      if (!isNonEmptyString(value.testCaseId, MAX_ID_LENGTH)) return null;
      const patch = parseTestCasePatch(value.patch);
      return patch ? { type: "updateTestCase", testCaseId: value.testCaseId, patch } : null;
    }
    case "addBug": {
      const bug = parseBug(value.bug);
      return bug ? { type: "addBug", bug } : null;
    }
    case "updateBug": {
      const bug = parseBug(value.bug);
      return bug ? { type: "updateBug", bug } : null;
    }
    case "mergeResults":
    case "replaceSnapshot":
      return null;
    default:
      return null;
  }
}

/** Worker 内部 RPC 向け（型付き payload をそのまま通す用途） */
export function parseProjectCommand(value: unknown): ProjectCommand | null {
  if (!isRecord(value) || typeof value.type !== "string") return null;
  if (!ALL_COMMAND_TYPES.has(value.type as ProjectCommand["type"])) return null;
  if (value.type === "mergeResults" || value.type === "replaceSnapshot") {
    return value as ProjectCommand;
  }
  return parseCommandBody(value, ALL_COMMAND_TYPES);
}

/** WebSocket クライアント向けの厳密 validation */
export function parseClientProjectCommand(value: unknown): ProjectCommand | null {
  return parseCommandBody(value, CLIENT_COMMAND_TYPES);
}

import type { ProjectCommand } from "./project-command";

const COMMAND_TYPES = new Set<ProjectCommand["type"]>([
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

function isRecord(value: unknown): value is Record<string, unknown> {
  return value != null && typeof value === "object";
}

/** WebSocket / Worker 向けの最小 runtime validation */
export function parseProjectCommand(value: unknown): ProjectCommand | null {
  if (!isRecord(value) || typeof value.type !== "string") return null;
  if (!COMMAND_TYPES.has(value.type as ProjectCommand["type"])) return null;

  switch (value.type) {
    case "setSession":
      return isRecord(value.session) ? (value as ProjectCommand) : null;
    case "updateResult":
      return typeof value.testCaseId === "string" && typeof value.envId === "string" && isRecord(value.entry)
        ? (value as ProjectCommand)
        : null;
    case "updateResultsBatch":
      return (
        typeof value.testCaseId === "string" &&
        Array.isArray(value.envIds) &&
        isRecord(value.partial) &&
        typeof value.partial.status === "string"
      )
        ? (value as ProjectCommand)
        : null;
    case "clearTestResult":
      return typeof value.testCaseId === "string" && typeof value.envId === "string"
        ? (value as ProjectCommand)
        : null;
    case "clearResults":
    case "mergeResults":
    case "replaceSnapshot":
    case "addBug":
    case "updateBug":
    case "updateTestCase":
      return value as ProjectCommand;
    default:
      return null;
  }
}

import {
  getProjectIdFromDefinition,
  mergeResultsFiles,
  parseResultsJson,
  type ResultsFile,
  type TestDefinition,
} from "@qarows/shared";

export class GenerationMismatchError extends Error {
  constructor(
    message = "tests.yml が更新されたため結果の取り込みできません。最新の状態を取得して再試行してください",
  ) {
    super(message);
    this.name = "GenerationMismatchError";
  }
}

export class MergeResultsValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "MergeResultsValidationError";
  }
}

export interface MergeResultsRequestBody {
  resultsJsonList: string[];
  expectedGeneration: string;
}

export function parseMergeResultsBody(raw: unknown): MergeResultsRequestBody {
  if (typeof raw !== "object" || raw === null) {
    throw new MergeResultsValidationError("Invalid JSON body");
  }
  const body = raw as { resultsJsonList?: unknown; expectedGeneration?: unknown };
  const list = body.resultsJsonList;
  if (!Array.isArray(list) || list.length === 0) {
    throw new MergeResultsValidationError("resultsJsonList is required");
  }
  if (!list.every((item) => typeof item === "string")) {
    throw new MergeResultsValidationError("resultsJsonList must contain strings");
  }
  const expectedGeneration = body.expectedGeneration;
  if (typeof expectedGeneration !== "string" || expectedGeneration.length === 0) {
    throw new MergeResultsValidationError("expectedGeneration is required");
  }
  return { resultsJsonList: list, expectedGeneration };
}

/** 全ファイルを先に検証し、Phase 1 ルールで 1 つの ResultsFile にまとめる */
export function parseAndMergeResultsJsonList(
  resultsJsonList: string[],
  definition: TestDefinition,
): ResultsFile {
  let merged: ResultsFile | null = null;
  for (let index = 0; index < resultsJsonList.length; index++) {
    const resultsJson = resultsJsonList[index]!;
    try {
      const parsed = parseResultsJson(resultsJson, { definition });
      merged = merged ? mergeResultsFiles(merged, parsed) : parsed;
    } catch (err) {
      const detail = err instanceof Error ? err.message : "Invalid results.json";
      throw new MergeResultsValidationError(
        resultsJsonList.length > 1 ? `${detail} (file ${index + 1})` : detail,
      );
    }
  }
  if (!merged) {
    throw new MergeResultsValidationError("resultsJsonList is required");
  }
  return merged;
}

export function assertGenerationMatch(
  expectedGeneration: string,
  actualGeneration: string | null | undefined,
): void {
  if (expectedGeneration !== actualGeneration) {
    throw new GenerationMismatchError();
  }
}

export function parseOptionalResultsJsonList(raw: unknown): string[] | undefined {
  if (raw === undefined || raw === null) return undefined;
  if (!Array.isArray(raw)) {
    throw new MergeResultsValidationError("resultsJsonList must be an array");
  }
  if (raw.length === 0) return undefined;
  if (!raw.every((item) => typeof item === "string")) {
    throw new MergeResultsValidationError("resultsJsonList must contain strings");
  }
  return raw;
}

export function mergeIncomingForNewProject(
  resultsJsonList: string[] | undefined,
  definition: TestDefinition,
): ResultsFile | undefined {
  if (!resultsJsonList?.length) return undefined;
  return parseAndMergeResultsJsonList(resultsJsonList, definition);
}

export function projectIdFromDefinition(definition: TestDefinition): string {
  return getProjectIdFromDefinition(definition);
}

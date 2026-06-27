import type { ResultsFile, TestResults } from "./types";

export function clearTestCaseEnvironmentResult(
  results: ResultsFile,
  testCaseId: string,
  envId: string,
): ResultsFile {
  const caseResults = results.results[testCaseId];
  if (!caseResults?.[envId]) return results;

  const { [envId]: _removed, ...rest } = caseResults;
  const nextCaseResults: TestResults = { ...results.results };

  if (Object.keys(rest).length > 0) {
    nextCaseResults[testCaseId] = rest;
  } else {
    delete nextCaseResults[testCaseId];
  }

  return {
    ...results,
    updatedAt: new Date().toISOString(),
    results: nextCaseResults,
  };
}

import { createEmptyResults, serializeResultsJson } from "@qarows/shared";
import { makeDefinition } from "@qarows/shared/test-fixtures";
import { describe, expect, it } from "vitest";
import {
  GenerationMismatchError,
  MergeResultsValidationError,
  assertGenerationMatch,
  parseAndMergeResultsJsonList,
  parseMergeResultsBody,
} from "./merge-results";

describe("parseMergeResultsBody", () => {
  it("accepts resultsJsonList and expectedGeneration", () => {
    expect(
      parseMergeResultsBody({
        resultsJsonList: ['{"projectId":"a"}'],
        expectedGeneration: "gen-1",
      }),
    ).toEqual({
      resultsJsonList: ['{"projectId":"a"}'],
      expectedGeneration: "gen-1",
    });
  });

  it("rejects empty list", () => {
    expect(() =>
      parseMergeResultsBody({ resultsJsonList: [], expectedGeneration: "gen-1" }),
    ).toThrow(MergeResultsValidationError);
  });

  it("rejects missing expectedGeneration", () => {
    expect(() => parseMergeResultsBody({ resultsJsonList: ['{"projectId":"a"}'] })).toThrow(
      "expectedGeneration is required",
    );
  });
});

describe("parseAndMergeResultsJsonList", () => {
  const definition = makeDefinition();

  it("merges multiple valid files into one ResultsFile", () => {
    const base = createEmptyResults("test");
    base.results["TC-001"] = {
      chrome: { status: "OK", executedAt: "2026-01-01T00:00:00.000Z", executedBy: "a" },
    };
    const incoming = createEmptyResults("test");
    incoming.results["TC-002"] = {
      firefox: { status: "NG", executedAt: "2026-01-02T00:00:00.000Z", executedBy: "b" },
    };

    const merged = parseAndMergeResultsJsonList(
      [serializeResultsJson(base), serializeResultsJson(incoming)],
      definition,
    );

    expect(merged.results["TC-001"]?.chrome?.status).toBe("OK");
    expect(merged.results["TC-002"]?.firefox?.status).toBe("NG");
  });

  it("does not partially apply when a later file is invalid", () => {
    const valid = serializeResultsJson(createEmptyResults("test"));
    const invalid = '{"projectId":"test","results":{"UNKNOWN":{"chrome":{"status":"OK"}}}}';

    expect(() => parseAndMergeResultsJsonList([valid, invalid], definition)).toThrow(
      MergeResultsValidationError,
    );
  });

  it("includes file index in error for multi-file failures", () => {
    const invalid = '{"not":"results"}';
    expect(() => parseAndMergeResultsJsonList([invalid], definition)).toThrow(
      MergeResultsValidationError,
    );
    expect(() =>
      parseAndMergeResultsJsonList(
        [serializeResultsJson(createEmptyResults("test")), invalid],
        definition,
      ),
    ).toThrow(/file 2/);
  });
});

describe("assertGenerationMatch", () => {
  it("passes when generations match", () => {
    expect(() => assertGenerationMatch("gen-a", "gen-a")).not.toThrow();
  });

  it("throws GenerationMismatchError on mismatch", () => {
    expect(() => assertGenerationMatch("gen-a", "gen-b")).toThrow(GenerationMismatchError);
  });
});

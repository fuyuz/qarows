import { describe, expect, it } from "vitest";
import { makeDefinition } from "@qarows/shared/test-fixtures";
import { parseClientProjectCommand, parseProjectCommand } from "./parse-project-command";

describe("parseClientProjectCommand", () => {
  it("accepts updateResult", () => {
    const cmd = parseClientProjectCommand({
      type: "updateResult",
      testCaseId: "TC-001",
      envId: "chrome",
      entry: { status: "OK", executedAt: "2026-06-28T12:00:00.000Z" },
    });
    expect(cmd?.type).toBe("updateResult");
  });

  it("accepts setSession without executorName", () => {
    const cmd = parseClientProjectCommand({
      type: "setSession",
      session: { selectedEnvironmentIds: ["chrome"] },
    });
    expect(cmd).toEqual({
      type: "setSession",
      session: { executorName: "", selectedEnvironmentIds: ["chrome"] },
    });
  });

  it("rejects mergeResults from client", () => {
    expect(
      parseClientProjectCommand({
        type: "mergeResults",
        incoming: { version: 1, projectId: "x", updatedAt: "", results: {}, bugs: [] },
      }),
    ).toBeNull();
  });

  it("rejects replaceSnapshot from client", () => {
    const definition = makeDefinition();
    expect(
      parseClientProjectCommand({
        type: "replaceSnapshot",
        definition,
        results: { version: 1, projectId: "test", updatedAt: "", results: {}, bugs: [] },
        session: null,
      }),
    ).toBeNull();
  });

  it("rejects clearResults from client", () => {
    expect(parseClientProjectCommand({ type: "clearResults" })).toBeNull();
  });

  it("rejects invalid bug payload", () => {
    expect(parseClientProjectCommand({ type: "addBug", bug: { id: "BUG-1", title: "" } })).toBeNull();
  });

  it("rejects legacy pending_verification bug status", () => {
    expect(
      parseClientProjectCommand({
        type: "addBug",
        bug: { id: "BUG-1", title: "x", severity: "medium", status: "pending_verification" },
      }),
    ).toBeNull();
  });

  it("rejects oversized memo", () => {
    expect(
      parseClientProjectCommand({
        type: "updateResultsBatch",
        testCaseId: "TC-001",
        envIds: ["chrome"],
        partial: { status: "OK", memo: "x".repeat(9000) },
      }),
    ).toBeNull();
  });
});

describe("parseProjectCommand", () => {
  it("still accepts internal mergeResults shape", () => {
    const cmd = parseProjectCommand({
      type: "mergeResults",
      incoming: { version: 1, projectId: "test", updatedAt: "", results: {}, bugs: [] },
    });
    expect(cmd?.type).toBe("mergeResults");
  });
});

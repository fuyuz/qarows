import { describe, expect, it } from "vitest";
import { makeDefinition } from "@qarows/shared/test-fixtures";
import { createEmptyResults } from "@qarows/shared";
import { applyProjectCommand } from "./apply-project-command";
import { parseClientProjectCommand } from "./parse-project-command";
import type { ProjectSnapshot } from "./types";
import { isValidIsoDateTime, ProjectCommandValidationError, validateProjectCommand } from "./validate-project-command";

const NOW = "2026-06-28T12:00:00.000Z";

function makeSnapshot(overrides: Partial<ProjectSnapshot> = {}): ProjectSnapshot {
  const definition = makeDefinition();
  const id = definition.project.id ?? "test";
  return {
    id,
    name: definition.project.name,
    definition,
    results: createEmptyResults(id),
    session: null,
    updatedAt: NOW,
    ...overrides,
  };
}

describe("validateProjectCommand", () => {
  it("rejects unknown testCaseId on updateResult", () => {
    const snapshot = makeSnapshot();
    expect(() =>
      validateProjectCommand(snapshot, {
        type: "updateResult",
        testCaseId: "NO-SUCH",
        envId: "chrome",
        entry: { status: "OK" },
      }),
    ).toThrow(ProjectCommandValidationError);
  });

  it("rejects unknown envId on updateResult", () => {
    const snapshot = makeSnapshot();
    expect(() =>
      validateProjectCommand(snapshot, {
        type: "updateResult",
        testCaseId: "TC-001",
        envId: "phantom-env",
        entry: { status: "OK" },
      }),
    ).toThrow(/Unknown envId/);
  });

  it("rejects session with unknown environment ids", () => {
    const snapshot = makeSnapshot();
    expect(() =>
      validateProjectCommand(snapshot, {
        type: "setSession",
        session: { executorName: "Alice", selectedEnvironmentIds: ["phantom-env"] },
      }),
    ).toThrow(/Unknown envId/);
  });

  it("rejects duplicate bug id on addBug", () => {
    const snapshot = makeSnapshot({
      results: {
        ...createEmptyResults("test"),
        bugs: [{ id: "BUG-001", title: "x", severity: "low", status: "open" }],
      },
    });
    expect(() =>
      validateProjectCommand(snapshot, {
        type: "addBug",
        bug: { id: "BUG-001", title: "dup", severity: "low", status: "open" },
      }),
    ).toThrow(/already exists/);
  });

  it("rejects updateBug for missing bug", () => {
    const snapshot = makeSnapshot();
    expect(() =>
      validateProjectCommand(snapshot, {
        type: "updateBug",
        bug: { id: "BUG-404", title: "x", severity: "low", status: "open" },
      }),
    ).toThrow(/Unknown bug id/);
  });

  it("rejects invalid executedAt", () => {
    const snapshot = makeSnapshot();
    expect(() =>
      validateProjectCommand(snapshot, {
        type: "updateResult",
        testCaseId: "TC-001",
        envId: "chrome",
        entry: { status: "OK", executedAt: "not-a-date" },
      }),
    ).toThrow(/executedAt/);
  });
});

describe("isValidIsoDateTime", () => {
  it("accepts ISO datetime", () => {
    expect(isValidIsoDateTime("2026-06-28T12:00:00.000Z")).toBe(true);
  });

  it("rejects non-ISO strings", () => {
    expect(isValidIsoDateTime("2026-06-28")).toBe(false);
    expect(isValidIsoDateTime("invalid")).toBe(false);
  });
});

describe("applyProjectCommand reference integrity", () => {
  it("throws when updateResultsBatch targets unknown test case", () => {
    const snapshot = makeSnapshot({
      session: { executorName: "Alice", selectedEnvironmentIds: ["chrome"] },
    });
    expect(() =>
      applyProjectCommand(snapshot, {
        type: "updateResultsBatch",
        testCaseId: "NO-SUCH",
        envIds: ["chrome"],
        partial: { status: "OK" },
      }),
    ).toThrow(ProjectCommandValidationError);
  });
});

describe("parseClientProjectCommand bug status", () => {
  it("rejects legacy pending_verification status", () => {
    expect(
      parseClientProjectCommand({
        type: "addBug",
        bug: {
          id: "BUG-001",
          title: "x",
          severity: "medium",
          status: "pending_verification",
        },
      }),
    ).toBeNull();
  });

  it("rejects invalid executedAt at parse time", () => {
    expect(
      parseClientProjectCommand({
        type: "updateResult",
        testCaseId: "TC-001",
        envId: "chrome",
        entry: { status: "OK", executedAt: "yesterday" },
      }),
    ).toBeNull();
  });
});

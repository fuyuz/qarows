import { describe, expect, it } from "vitest";
import { createEmptyResults } from "@qarows/shared";
import { makeDefinition } from "@qarows/shared/test-fixtures";
import { parseServerMessage } from "./protocol";

describe("parseServerMessage", () => {
  it("parses snapshot message", () => {
    const definition = makeDefinition();
    const results = createEmptyResults("test");
    const raw = JSON.stringify({
      type: "snapshot",
      snapshot: {
        generation: "gen-1",
        revision: 0,
        definition,
        results,
        session: null,
      },
    });

    const parsed = parseServerMessage(raw);
    expect(parsed?.type).toBe("snapshot");
    if (parsed?.type === "snapshot") {
      expect(parsed.snapshot.definition.project.id).toBe("test");
    }
  });

  it("parses commandApplied message", () => {
    const definition = makeDefinition();
    const results = createEmptyResults("test");
    const raw = JSON.stringify({
      type: "commandApplied",
      command: {
        type: "updateResultsBatch",
        testCaseId: "TC-001",
        envIds: ["chrome"],
        partial: { status: "OK" },
      },
      commandId: "cmd-1",
      user: "qa@example.com",
      revision: 1,
      appliedAt: "2026-06-28T12:00:00.000Z",
      snapshot: {
        generation: "gen-1",
        revision: 1,
        definition,
        results,
        session: { executorName: "Alice", selectedEnvironmentIds: ["chrome"] },
      },
    });

    const parsed = parseServerMessage(raw);
    expect(parsed?.type).toBe("commandApplied");
    if (parsed?.type === "commandApplied") {
      expect(parsed.revision).toBe(1);
      expect(parsed.commandId).toBe("cmd-1");
      expect(parsed.snapshot.generation).toBe("gen-1");
    }
  });

  it("parses snapshotReplaced message", () => {
    const definition = makeDefinition();
    const results = createEmptyResults("test");
    const parsed = parseServerMessage(
      JSON.stringify({
        type: "snapshotReplaced",
        generation: "gen-2",
        revision: 0,
        snapshot: {
          generation: "gen-2",
          revision: 0,
          definition,
          results,
          session: null,
        },
      }),
    );
    expect(parsed?.type).toBe("snapshotReplaced");
  });

  it("parses error message", () => {
    const parsed = parseServerMessage(JSON.stringify({ type: "error", message: "fail" }));
    expect(parsed).toEqual({ type: "error", message: "fail" });
  });

  it("returns null for invalid JSON", () => {
    expect(parseServerMessage("not-json")).toBeNull();
  });
});

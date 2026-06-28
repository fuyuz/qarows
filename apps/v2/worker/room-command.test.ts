import { describe, expect, it } from "vitest";
import { applyProjectCommand, toProjectSnapshot } from "@qarows/application";
import { createEmptyResults } from "@qarows/shared";
import { makeDefinition } from "@qarows/shared/test-fixtures";
import type { ProjectCommand } from "@qarows/application";

interface RoomState {
  revision: number;
  definition: ReturnType<typeof makeDefinition>;
  results: ReturnType<typeof createEmptyResults>;
  session: { executorName: string; selectedEnvironmentIds: string[] } | null;
}

interface ApplyResult {
  revision: number;
  duplicate: boolean;
  state: RoomState;
}

/** ProjectRoom.applyCommand と同じ dedup + applyProjectCommand フロー（DO なしで検証） */
function applyRoomCommand(
  state: RoomState,
  processed: Map<string, { revision: number; user: string }>,
  commandId: string,
  command: ProjectCommand,
  user: string,
  projectId: string,
): ApplyResult {
  const existing = processed.get(commandId);
  if (existing) {
    return { revision: existing.revision, duplicate: true, state };
  }

  const snapshot = toProjectSnapshot(projectId, {
    definition: state.definition,
    results: state.results,
    session: state.session,
    updatedAt: state.results.updatedAt,
  });

  const { snapshot: next } = applyProjectCommand(snapshot, command);
  const nextState: RoomState = {
    revision: state.revision + 1,
    definition: next.definition,
    results: next.results,
    session: next.session,
  };

  processed.set(commandId, { revision: nextState.revision, user });

  return { revision: nextState.revision, duplicate: false, state: nextState };
}

describe("room command flow", () => {
  const projectId = "test";
  const NOW = "2026-06-28T12:00:00.000Z";

  function makeRoomState(): RoomState {
    const definition = makeDefinition();
    return {
      revision: 0,
      definition,
      results: createEmptyResults(projectId),
      session: { executorName: "Alice", selectedEnvironmentIds: ["chrome"] },
    };
  }

  it("applies command and increments revision", () => {
    let state = makeRoomState();
    const processed = new Map<string, { revision: number; user: string }>();

    const result = applyRoomCommand(
      state,
      processed,
      "cmd-1",
      {
        type: "updateResultsBatch",
        testCaseId: "TC-001",
        envIds: ["chrome"],
        partial: { status: "OK" },
      },
      "qa@example.com",
      projectId,
    );

    expect(result.duplicate).toBe(false);
    expect(result.revision).toBe(1);
    expect(result.state.results.results["TC-001"]?.chrome?.status).toBe("OK");
    state = result.state;

    const again = applyRoomCommand(
      state,
      processed,
      "cmd-1",
      {
        type: "updateResultsBatch",
        testCaseId: "TC-001",
        envIds: ["chrome"],
        partial: { status: "NG" },
      },
      "qa@example.com",
      projectId,
    );

    expect(again.duplicate).toBe(true);
    expect(again.revision).toBe(1);
    expect(again.state.results.results["TC-001"]?.chrome?.status).toBe("OK");
  });

  it("applies sequential distinct commands with rising revision", () => {
    let state = makeRoomState();
    const processed = new Map<string, { revision: number; user: string }>();

    const first = applyRoomCommand(
      state,
      processed,
      "cmd-a",
      {
        type: "updateResultsBatch",
        testCaseId: "TC-001",
        envIds: ["chrome"],
        partial: { status: "OK" },
      },
      "user-a",
      projectId,
    );
    state = first.state;

    const second = applyRoomCommand(
      state,
      processed,
      "cmd-b",
      {
        type: "updateResultsBatch",
        testCaseId: "TC-002",
        envIds: ["chrome"],
        partial: { status: "SKIP" },
      },
      "user-b",
      projectId,
    );

    expect(first.revision).toBe(1);
    expect(second.revision).toBe(2);
    expect(second.duplicate).toBe(false);
    expect(second.state.results.results["TC-002"]?.chrome?.status).toBe("SKIP");
    expect(second.state.results.updatedAt).not.toBe(NOW);
  });
});

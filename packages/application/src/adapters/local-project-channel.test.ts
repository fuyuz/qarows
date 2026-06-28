import { describe, expect, it } from "vitest";
import { makeDefinition } from "@qarows/shared/test-fixtures";
import { createEmptyResults } from "@qarows/shared";
import { LocalProjectChannel } from "./local-project-channel";
import type { ProjectSnapshot } from "../types";

function makeSnapshot(): ProjectSnapshot {
  const definition = makeDefinition();
  const id = definition.project.id ?? "test";
  return {
    id,
    name: definition.project.name,
    definition,
    results: createEmptyResults(id),
    session: { executorName: "Tester", selectedEnvironmentIds: ["chrome"] },
    updatedAt: "2026-06-28T12:00:00.000Z",
  };
}

describe("LocalProjectChannel", () => {
  it("applies commands serially and emits events", async () => {
    const persisted: ProjectSnapshot[] = [];
    const channel = new LocalProjectChannel({
      onPersist: async (snapshot) => {
        persisted.push(snapshot);
      },
    });

    const appliedRevisions: number[] = [];
    channel.connect("test", {
      onEvent: (event) => {
        if (event.type === "commandApplied") {
          appliedRevisions.push(event.revision);
        }
      },
    });

    const snapshot = makeSnapshot();
    channel.loadSnapshot(snapshot);

    await Promise.all([
      channel.send({
        commandId: "c1",
        command: {
          type: "updateResultsBatch",
          testCaseId: "TC-001",
          envIds: ["chrome"],
          partial: { status: "OK" },
        },
      }),
      channel.send({
        commandId: "c2",
        command: {
          type: "updateResultsBatch",
          testCaseId: "TC-002",
          envIds: ["chrome"],
          partial: { status: "SKIP" },
        },
      }),
    ]);

    expect(appliedRevisions).toEqual([1, 2]);
    expect(persisted).toHaveLength(2);
    expect(channel.getSnapshot()?.results.results["TC-001"]?.chrome?.status).toBe("OK");
    expect(channel.getSnapshot()?.results.results["TC-002"]?.chrome?.status).toBe("SKIP");
  });
});

import "fake-indexeddb/auto";
import { describe, expect, it, beforeEach } from "vitest";
import { createEmptyResults, parseTestsYaml } from "@qarows/shared";
import { resetStorageForTests } from "@/lib/storage";
import { IndexedDbProjectRepository } from "./indexed-db-project-repository";
import { createPhase1WorkspaceController } from "./create-phase1-workspace";

describe("IndexedDbProjectRepository + WorkspaceController", () => {
  beforeEach(async () => {
    await resetStorageForTests();
  });

  it("loads project and dispatches updateResultsBatch", async () => {
    const repository = new IndexedDbProjectRepository();
    const controller = createPhase1WorkspaceController(repository);
    const yaml = `project:
  name: Demo
  id: demo
environments:
  - id: chrome
    name: Chrome
testCases:
  - id: TC-001
    category:
      major: Auth
    description: Login
`;
    const definition = parseTestsYaml(yaml);
    const snapshot = {
      id: "demo",
      name: "Demo",
      definition,
      results: createEmptyResults("demo"),
      session: null,
      updatedAt: "2026-06-28T12:00:00.000Z",
    };

    await controller.saveSnapshot(snapshot);
    const activated = await controller.activateProject("demo");
    expect(activated).toBe(true);

    await controller.dispatch({
      type: "setSession",
      session: { executorName: "Alice", selectedEnvironmentIds: ["chrome"] },
    });

    const next = await controller.dispatch({
      type: "updateResultsBatch",
      testCaseId: "TC-001",
      envIds: ["chrome"],
      partial: { status: "OK" },
    });

    expect(next.results.results["TC-001"]?.chrome?.status).toBe("OK");
    expect(next.results.results["TC-001"]?.chrome?.executedBy).toBe("Alice");

    const reloaded = await repository.getSnapshot("demo");
    expect(reloaded?.results.results["TC-001"]?.chrome?.status).toBe("OK");
  });
});

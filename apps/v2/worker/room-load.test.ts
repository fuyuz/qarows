import { describe, expect, it } from "vitest";
import { createEmptyResults } from "@qarows/shared";
import { makeDefinition } from "@qarows/shared/test-fixtures";
import { hasValidRoomGeneration, resolveProjectIdFromRoomCache, type RoomCacheShape } from "./room-load";

function legacyCacheWithoutGeneration(projectId: string): RoomCacheShape & {
  revision: number;
  results: ReturnType<typeof createEmptyResults>;
  session: null;
} {
  return {
    revision: 3,
    definition: makeDefinition({ project: { name: "QA", id: projectId } }),
    results: createEmptyResults(projectId),
    session: null,
  };
}

describe("hasValidRoomGeneration", () => {
  it("rejects legacy cache without generation", () => {
    expect(hasValidRoomGeneration(legacyCacheWithoutGeneration("qarows"))).toBe(false);
  });

  it("accepts cache with generation", () => {
    expect(hasValidRoomGeneration({ generation: "gen-1" })).toBe(true);
  });
});

describe("cold DO legacy cache + first replace", () => {
  it("recovers projectId from legacy cache so D1 reload can proceed", () => {
    const cached = legacyCacheWithoutGeneration("qarows");
    const projectId = resolveProjectIdFromRoomCache(cached, null);

    expect(projectId).toBe("qarows");
    expect(hasValidRoomGeneration(cached)).toBe(false);
  });

  it("prefers explicit projectId from Worker RPC over cache", () => {
    const cached = legacyCacheWithoutGeneration("from-cache");
    expect(resolveProjectIdFromRoomCache(cached, "from-rpc")).toBe("from-rpc");
  });

  it("falls back to explicit projectId when cache is absent", () => {
    expect(resolveProjectIdFromRoomCache(null, "qarows")).toBe("qarows");
  });
});

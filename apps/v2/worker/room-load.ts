import type { TestDefinition } from "@qarows/shared";

export interface RoomCacheShape {
  generation?: string;
  definition: TestDefinition;
}

export function hasValidRoomGeneration(
  state: { generation?: string } | null | undefined,
): boolean {
  return typeof state?.generation === "string" && state.generation.length > 0;
}

/** 無効な legacy キャッシュからも projectId を回収する（cold DO + Worker RPC 向け） */
export function resolveProjectIdFromRoomCache(
  cached: RoomCacheShape | null | undefined,
  projectId: string | null,
): string | null {
  if (projectId) return projectId;
  return cached?.definition?.project?.id ?? null;
}

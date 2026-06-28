import type { TestDefinition } from "./types";

/** tests.yml の project.id（未設定時は "project"） */
export function getProjectIdFromDefinition(definition: TestDefinition): string {
  return definition.project.id ?? "project";
}

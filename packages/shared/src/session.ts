import type { SessionConfig } from "./types";

export function isValidSession(session: SessionConfig): boolean {
  return (
    session.executorName.trim().length > 0 && session.selectedEnvironmentIds.length > 0
  );
}

export function validateSession(session: SessionConfig): void {
  if (!session.executorName.trim()) {
    throw new Error("実施者名を入力してください");
  }
  if (session.selectedEnvironmentIds.length === 0) {
    throw new Error("端末/環境を1つ以上選択してください");
  }
}

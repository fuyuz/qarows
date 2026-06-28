import type { ResultsFile, SessionConfig, TestDefinition } from "@qarows/shared";

/** ワークスペース全体の状態（Phase1/2 共通） */
export interface ProjectSnapshot {
  id: string;
  name: string;
  definition: TestDefinition;
  results: ResultsFile;
  session: SessionConfig | null;
  updatedAt: string;
  /** Phase2 の D1 由来。Phase1 では省略可 */
  createdAt?: string;
}

/** プロジェクト一覧用（`id` を正とする。Phase1 の `projectId` は移行時に正規化） */
export interface ProjectSummary {
  id: string;
  name: string;
  updatedAt: string;
  createdAt?: string;
  /** Phase1: 有効なセッション設定があるか */
  hasValidSession?: boolean;
}

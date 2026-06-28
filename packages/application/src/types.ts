import type { ResultsFile, SessionConfig, TestDefinition } from "@qarows/shared";

/** ワークスペース全体の状態（Local / Team 共通） */
export interface ProjectSnapshot {
  id: string;
  name: string;
  definition: TestDefinition;
  results: ResultsFile;
  session: SessionConfig | null;
  updatedAt: string;
  /** Team 版の D1 由来。Local 版では省略可 */
  createdAt?: string;
}

/** プロジェクト一覧用（`id` を正とする。Local 版の `projectId` は移行時に正規化） */
export interface ProjectSummary {
  id: string;
  name: string;
  updatedAt: string;
  createdAt?: string;
  /** Local 版: 有効なセッション設定があるか */
  hasValidSession?: boolean;
}

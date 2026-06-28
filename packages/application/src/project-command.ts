import type {
  Bug,
  ResultsFile,
  SessionConfig,
  TestCase,
  TestResultEntry,
  TestStatus,
} from "@qarows/shared";
import type { ProjectSnapshot } from "./types";

/** ドメイン更新の最小単位。Phase1/2 で同じコマンド → 同じ Snapshot を目指す */
export type ProjectCommand =
  | { type: "setSession"; session: SessionConfig }
  | {
      type: "updateResult";
      testCaseId: string;
      envId: string;
      entry: TestResultEntry;
    }
  | {
      type: "updateResultsBatch";
      testCaseId: string;
      envIds: string[];
      partial: Pick<TestResultEntry, "status" | "memo"> & { status: TestStatus };
    }
  | { type: "clearTestResult"; testCaseId: string; envId: string }
  | { type: "clearResults" }
  | {
      type: "updateTestCase";
      testCaseId: string;
      patch: Partial<Pick<TestCase, "category" | "prerequisites" | "description" | "version">>;
    }
  | { type: "addBug"; bug: Bug }
  | { type: "updateBug"; bug: Bug }
  | { type: "mergeResults"; incoming: ResultsFile }
  | {
      type: "replaceSnapshot";
      definition: ProjectSnapshot["definition"];
      results: ProjectSnapshot["results"];
      session: ProjectSnapshot["session"];
    };

export interface ApplyProjectCommandOptions {
  /** テスト用固定時刻。省略時は実行時の ISO 文字列 */
  now?: string;
}

export interface ApplyProjectCommandResult {
  snapshot: ProjectSnapshot;
  /** 更新があったテストケース ID（UI ハイライト用）。なければ null */
  affectedTestCaseId: string | null;
}

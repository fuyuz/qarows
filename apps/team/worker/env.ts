import type { ProjectRoom } from "./project-room";

/** Worker bindings — extend generated CloudflareEnv with typed Durable Object namespace. */
export interface Env extends Omit<CloudflareEnv, "PROJECT" | "AI"> {
  PROJECT: DurableObjectNamespace<ProjectRoom>;
  AI?: Ai;
  /** Rate Limiting binding。未設定なら isolate ローカルの暫定制限にフォールバックする */
  AI_RATE_LIMIT?: RateLimit;
}

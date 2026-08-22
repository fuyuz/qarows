import { createMiddleware } from "hono/factory";
import { PROJECT_ID_PATTERN } from "@qarows/shared";
import { apiError } from "../i18n";
import type { AppEnv } from "../types";

/**
 * `/api/projects/:projectId` 配下の projectId を DO 名・R2 キーに使う前に検証する。
 * 添付系だけがハンドラ内で検証していて、GET/PUT/DELETE・/ws・AI 系は素通しだったため、
 * 任意の文字列で DO 名前空間を作れる状態だった
 */
export const projectIdMiddleware = createMiddleware<AppEnv>(async (c, next) => {
  const projectId = c.req.param("projectId");
  if (!projectId || !PROJECT_ID_PATTERN.test(projectId)) {
    apiError(c, 400, "api.invalidProjectId");
  }
  await next();
});

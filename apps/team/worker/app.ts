import { Hono } from "hono";
import { HTTPException } from "hono/http-exception";
import { accessMiddleware } from "./middleware/access";
import { csrfMiddleware } from "./middleware/csrf";
import { localeMiddleware } from "./middleware/locale";
import { projectIdMiddleware } from "./middleware/project-id";
import { requestIdMiddleware, securityHeadersMiddleware } from "./middleware/security-headers";
import { createAiRoutes } from "./routes/ai";
import { attachmentsRoutes } from "./routes/attachments";
import { projectsRoutes } from "./routes/projects";
import { resolveAiModelConfig } from "./ai/models";
import { apiError, requestT } from "./i18n";
import { isAccessRequired, isMcpHostRequest } from "./auth";
import { handleMcp, MCP_PATH } from "./mcp/route";
import type { AppEnv } from "./types";

export function createApp() {
  const app = new Hono<AppEnv>();

  app.onError((err, c) => {
    if (err instanceof HTTPException) {
      const requestId = c.get("requestId");
      return c.json(
        { error: err.message, ...(requestId ? { requestId } : {}) },
        err.status,
      );
    }
    const requestId = c.get("requestId");
    console.error(`[${requestId}] Unhandled error`, err);
    return c.json(
      { error: requestT(c, "api.internalServerError"), ...(requestId ? { requestId } : {}) },
      500,
    );
  });

  app.use("*", requestIdMiddleware);
  app.use("*", localeMiddleware);
  app.use("*", securityHeadersMiddleware);

  // MCP 専用ホストでは /mcp 以外（画面・/api）を返さない。画面用ホストの /mcp は
  // ローカル開発（AUTH_DEV_BYPASS + localhost:8787）以外では無効
  app.use("*", async (c, next) => {
    const path = new URL(c.req.url).pathname;
    const onMcpHost = isMcpHostRequest(c.req.raw, c.env);
    if (onMcpHost && path !== MCP_PATH) apiError(c, 404, "api.notFound");
    if (!onMcpHost && path === MCP_PATH && isAccessRequired(c.env, c.req.raw)) {
      apiError(c, 404, "api.notFound");
    }
    await next();
  });

  app.use("*", accessMiddleware);
  app.use("*", csrfMiddleware);

  app.get("/api/health", (c) => {
    const aiModels = resolveAiModelConfig(c.env);
    return c.json({
      ok: true,
      service: "qarows-team",
      aiEnabled: c.env.AI != null,
      attachmentsEnabled: c.env.ATTACHMENTS != null,
      ...(c.env.AI != null
        ? {
            aiModel: aiModels.primary,
            ...(aiModels.fallback ? { aiModelFallback: aiModels.fallback } : {}),
          }
        : {}),
    });
  });

  app.get("/api/me", (c) => c.json({ user: c.get("user") }));

  // route() より前に置く: 配下のハンドラが DO 名・R2 キーに使う前に弾く
  app.use("/api/projects/:projectId", projectIdMiddleware);
  app.use("/api/projects/:projectId/*", projectIdMiddleware);

  app.route("/api/projects", projectsRoutes);
  app.route("/api/projects", attachmentsRoutes);
  app.route("/api/projects", createAiRoutes());

  app.all(MCP_PATH, (c) => handleMcp(c));

  app.all("/api/*", (c) => {
    apiError(c, 404, "api.notFound");
  });

  app.all("*", async (c) => c.env.ASSETS.fetch(c.req.raw));

  return app;
}

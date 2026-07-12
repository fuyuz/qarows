import { Hono } from "hono";
import { HTTPException } from "hono/http-exception";
import { accessMiddleware } from "./middleware/access";
import { csrfMiddleware } from "./middleware/csrf";
import { requestIdMiddleware, securityHeadersMiddleware } from "./middleware/security-headers";
import { createAiRoutes } from "./routes/ai";
import { projectsRoutes } from "./routes/projects";
import { resolveAiModelConfig } from "./ai/models";
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
      { error: "Internal Server Error", ...(requestId ? { requestId } : {}) },
      500,
    );
  });

  app.use("*", requestIdMiddleware);
  app.use("*", securityHeadersMiddleware);
  app.use("*", accessMiddleware);
  app.use("*", csrfMiddleware);

  app.get("/api/health", (c) => {
    const aiModels = resolveAiModelConfig(c.env);
    return c.json({
      ok: true,
      service: "qarows-v2",
      aiEnabled: c.env.AI != null,
      ...(c.env.AI != null
        ? {
            aiModel: aiModels.primary,
            ...(aiModels.fallback ? { aiModelFallback: aiModels.fallback } : {}),
          }
        : {}),
    });
  });

  app.get("/api/me", (c) => c.json({ user: c.get("user") }));

  app.route("/api/projects", projectsRoutes);
  app.route("/api/projects", createAiRoutes());

  app.all("/api/*", () => {
    throw new HTTPException(404, { message: "Not found" });
  });

  app.all("*", async (c) => c.env.ASSETS.fetch(c.req.raw));

  return app;
}

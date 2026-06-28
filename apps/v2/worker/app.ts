import { Hono } from "hono";
import { HTTPException } from "hono/http-exception";
import { getAuthUser } from "./auth";
import { projectsRoutes } from "./routes/projects";
import type { AppEnv } from "./types";

export function createApp() {
  const app = new Hono<AppEnv>();

  app.onError((err, c) => {
    if (err instanceof HTTPException) {
      return c.json({ error: err.message }, err.status);
    }
    console.error(err);
    return c.json({ error: "Internal Server Error" }, 500);
  });

  app.get("/api/health", (c) =>
    c.json({
      ok: true,
      service: "qarows-v2",
      phase: 2,
    }),
  );

  app.get("/api/me", (c) => c.json({ user: getAuthUser(c.req.raw) }));

  app.route("/api/projects", projectsRoutes);

  app.all("/api/*", (c) => {
    throw new HTTPException(404, { message: "Not found" });
  });

  app.all("*", async (c) => c.env.ASSETS.fetch(c.req.raw));

  return app;
}

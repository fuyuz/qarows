import { createMiddleware } from "hono/factory";
import { getAuthUser } from "../auth";
import type { AppEnv } from "../types";

/** Attach authenticated user (Cloudflare Access or dev header). */
export const authMiddleware = createMiddleware<AppEnv>(async (c, next) => {
  c.set("user", getAuthUser(c.req.raw));
  await next();
});

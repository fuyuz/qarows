import { createMiddleware } from "hono/factory";
import { HTTPException } from "hono/http-exception";
import { AccessDeniedError, resolveAuthUser } from "../auth";
import type { AppEnv } from "../types";

/** Enforce Cloudflare Access (production) and attach authenticated user. */
export const accessMiddleware = createMiddleware<AppEnv>(async (c, next) => {
  try {
    c.set("user", resolveAuthUser(c.req.raw, c.env));
  } catch (err) {
    if (err instanceof AccessDeniedError) {
      throw new HTTPException(err.status, { message: err.message });
    }
    throw err;
  }
  await next();
});

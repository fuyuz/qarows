import { createMiddleware } from "hono/factory";
import { HTTPException } from "hono/http-exception";
import { AccessDeniedError, assertMutatingRequestOrigin } from "../auth";
import type { AppEnv } from "../types";

const SAFE_METHODS = new Set(["GET", "HEAD", "OPTIONS"]);

/** Enforce same-origin (or local Vite proxy) on mutating `/api/*` requests. */
export const csrfMiddleware = createMiddleware<AppEnv>(async (c, next) => {
  const method = c.req.method.toUpperCase();
  if (SAFE_METHODS.has(method)) {
    await next();
    return;
  }

  const path = new URL(c.req.url).pathname;
  if (!path.startsWith("/api/")) {
    await next();
    return;
  }

  try {
    assertMutatingRequestOrigin(c.req.raw, c.env);
  } catch (err) {
    if (err instanceof AccessDeniedError) {
      throw new HTTPException(403, { message: err.message });
    }
    throw err;
  }

  await next();
});

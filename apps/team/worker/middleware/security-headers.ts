import { createMiddleware } from "hono/factory";
import type { AppEnv } from "../types";

/** Baseline security headers for API and static asset responses. */
export const securityHeadersMiddleware = createMiddleware<AppEnv>(async (c, next) => {
  await next();
  c.header("X-Content-Type-Options", "nosniff");
  c.header("Referrer-Policy", "strict-origin-when-cross-origin");
  c.header("Permissions-Policy", "camera=(), microphone=(), geolocation=()");
  // 添付配信など、ルートがより厳しい CSP（sandbox）を設定済みの場合は上書きしない
  if (!c.res.headers.has("Content-Security-Policy")) {
    c.header(
      "Content-Security-Policy",
      "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; connect-src 'self'; font-src 'self'; frame-ancestors 'none'; base-uri 'self'; form-action 'self'",
    );
  }
});

export const requestIdMiddleware = createMiddleware<AppEnv>(async (c, next) => {
  const requestId = crypto.randomUUID();
  c.set("requestId", requestId);
  await next();
  c.header("X-Request-Id", requestId);
});

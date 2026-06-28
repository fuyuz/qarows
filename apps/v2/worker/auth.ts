import type { Env } from "./env";

export interface AuthUser {
  email: string;
}

export class AccessDeniedError extends Error {
  readonly status = 401;

  constructor(message: string) {
    super(message);
    this.name = "AccessDeniedError";
  }
}

export function isAccessRequired(env: Env): boolean {
  return env.ACCESS_REQUIRED === "true";
}

function getAccessEmail(request: Request): string | null {
  const email = request.headers.get("Cf-Access-Authenticated-User-Email");
  if (!email) return null;
  const trimmed = email.trim();
  return trimmed || null;
}

function getDevEmail(request: Request): string | null {
  const devUser = request.headers.get("X-Qarows-User");
  if (!devUser) return null;
  const trimmed = devUser.trim();
  return trimmed || null;
}

function assertEmailAllowed(email: string, env: Env): void {
  const domain = env.ACCESS_ALLOWED_EMAIL_DOMAIN?.trim();
  if (!domain) return;

  const normalized = domain.replace(/^@/, "").toLowerCase();
  if (!email.toLowerCase().endsWith(`@${normalized}`)) {
    throw new AccessDeniedError("許可されていないメールアドレスです");
  }
}

/**
 * Resolve the authenticated user for this deployment's closed environment.
 * Production (ACCESS_REQUIRED=true): requires Cf-Access-Authenticated-User-Email from Cloudflare Access.
 * Local dev: optional X-Qarows-User header, otherwise dev@local.
 */
export function resolveAuthUser(request: Request, env: Env): AuthUser {
  const accessEmail = getAccessEmail(request);
  if (accessEmail) {
    assertEmailAllowed(accessEmail, env);
    return { email: accessEmail };
  }

  if (isAccessRequired(env)) {
    throw new AccessDeniedError(
      "Cloudflare Access による認証が必要です（Cf-Access-Authenticated-User-Email）",
    );
  }

  const devEmail = getDevEmail(request);
  if (devEmail) return { email: devEmail };

  return { email: "dev@local" };
}

export function requireAuthUser(request: Request, env: Env): AuthUser {
  return resolveAuthUser(request, env);
}

import type { Env } from "./env";
import { verifyAccessJwt } from "./access-jwt";

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

/** Local `wrangler dev` Worker host (Vite proxies here). */
export function isLocalDevWorkerRequest(request: Request): boolean {
  try {
    const url = new URL(request.url);
    if (url.hostname !== "localhost" && url.hostname !== "127.0.0.1") return false;
    return url.port === "8787";
  } catch {
    return false;
  }
}

/**
 * Access is required unless AUTH_DEV_BYPASS=true **and** the request hits local wrangler.
 * Setting AUTH_DEV_BYPASS on a deployed Worker is ignored (fail closed).
 */
export function isAccessRequired(env: Env, request?: Request): boolean {
  if (env.AUTH_DEV_BYPASS !== "true") return true;
  if (!request) return true;
  return !isLocalDevWorkerRequest(request);
}

function getAccessJwt(request: Request): string | null {
  const token = request.headers.get("Cf-Access-Jwt-Assertion");
  if (!token) return null;
  const trimmed = token.trim();
  return trimmed || null;
}

function getAccessEmailHeader(request: Request): string | null {
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

function parseEmailAllowlist(raw: string | undefined): string[] {
  if (!raw?.trim()) return [];
  return raw
    .split(",")
    .map((entry) => entry.trim().toLowerCase())
    .filter(Boolean);
}

function assertEmailAllowed(email: string, env: Env): void {
  const allowlist = parseEmailAllowlist(env.ACCESS_ALLOWED_EMAILS);
  if (allowlist.length > 0) {
    if (!allowlist.includes(email.toLowerCase())) {
      throw new AccessDeniedError("許可されていないメールアドレスです");
    }
    return;
  }

  const domain = env.ACCESS_ALLOWED_EMAIL_DOMAIN?.trim();
  if (!domain) return;

  const normalized = domain.replace(/^@/, "").toLowerCase();
  if (!email.toLowerCase().endsWith(`@${normalized}`)) {
    throw new AccessDeniedError("許可されていないメールアドレスです");
  }
}

function assertAccessConfig(env: Env): { teamDomain: string; audience: string } {
  const teamDomain = env.ACCESS_TEAM_DOMAIN?.trim();
  if (!teamDomain) {
    throw new AccessDeniedError("サーバー設定エラー: ACCESS_TEAM_DOMAIN が未設定です");
  }
  const audience = env.ACCESS_AUD?.trim();
  if (!audience) {
    throw new AccessDeniedError("サーバー設定エラー: ACCESS_AUD が未設定です");
  }
  return { teamDomain, audience };
}

function originsMatch(request: Request, originHeader: string): boolean {
  const requestOrigin = new URL(request.url).origin;
  const clientOrigin = new URL(originHeader).origin;
  return clientOrigin === requestOrigin;
}

/** Reject cross-origin WebSocket upgrades when Origin is present. */
export function assertWebSocketOrigin(request: Request, env?: Env): void {
  const origin = request.headers.get("Origin");
  if (!origin) return;

  try {
    if (originsMatch(request, origin)) return;
  } catch {
    throw new AccessDeniedError("Invalid Origin");
  }

  // Vite dev proxy: browser Origin is localhost:5177, Worker sees 127.0.0.1:8787.
  if (env && !isAccessRequired(env, request) && isLocalDevFrontendOrigin(origin)) {
    return;
  }

  throw new AccessDeniedError("Invalid Origin");
}

/**
 * Reject cross-site state-changing HTTP requests (CSRF defense for Access cookie sessions).
 * Same-origin SPA fetches send Origin; simple cross-site form POSTs are blocked.
 */
export function assertMutatingRequestOrigin(request: Request, env: Env): void {
  const origin = request.headers.get("Origin");
  if (origin) {
    try {
      if (originsMatch(request, origin)) return;
    } catch {
      throw new AccessDeniedError("Invalid Origin");
    }
    if (!isAccessRequired(env, request) && isLocalDevFrontendOrigin(origin)) {
      return;
    }
    throw new AccessDeniedError("Invalid Origin");
  }

  const secFetchSite = request.headers.get("Sec-Fetch-Site");
  if (secFetchSite === "same-origin") return;

  // Local wrangler / tests (curl) without Origin — only when bypass is active on localhost.
  if (!isAccessRequired(env, request)) return;

  throw new AccessDeniedError("Origin required");
}

function isLocalDevFrontendOrigin(origin: string): boolean {
  try {
    const url = new URL(origin);
    if (url.protocol !== "http:") return false;
    const port = url.port || "80";
    return (url.hostname === "localhost" || url.hostname === "127.0.0.1") && port === "5177";
  } catch {
    return false;
  }
}

async function resolveProductionUser(request: Request, env: Env): Promise<AuthUser> {
  const { teamDomain, audience } = assertAccessConfig(env);
  const token = getAccessJwt(request);
  if (!token) {
    throw new AccessDeniedError(
      "Cloudflare Access による認証が必要です（Cf-Access-Jwt-Assertion）",
    );
  }

  let email: string;
  try {
    const verified = await verifyAccessJwt(token, teamDomain, audience);
    email = verified.email;
  } catch {
    throw new AccessDeniedError("Cloudflare Access JWT の検証に失敗しました");
  }

  const headerEmail = getAccessEmailHeader(request);
  if (headerEmail && headerEmail.toLowerCase() !== email.toLowerCase()) {
    throw new AccessDeniedError("Access JWT とヘッダーの email が一致しません");
  }

  assertEmailAllowed(email, env);
  return { email };
}

/**
 * Resolve the authenticated user for this deployment's closed environment.
 * Production: verify Cf-Access-Jwt-Assertion, then optional allowlist/domain guard.
 * Local dev: optional X-Qarows-User header, otherwise dev@local.
 */
export async function resolveAuthUser(request: Request, env: Env): Promise<AuthUser> {
  if (isAccessRequired(env, request)) {
    return resolveProductionUser(request, env);
  }

  const devEmail = getDevEmail(request);
  if (devEmail) return { email: devEmail };

  return { email: "dev@local" };
}

export async function requireAuthUser(request: Request, env: Env): Promise<AuthUser> {
  return resolveAuthUser(request, env);
}

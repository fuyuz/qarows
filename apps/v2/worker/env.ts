import type { ProjectRoom } from "./project-room";

export interface Env {
  ASSETS: Fetcher;
  DB: D1Database;
  PROJECT: DurableObjectNamespace<ProjectRoom>;
  /** Local dev only (.dev.vars): set "true" to skip Access JWT. Never set in production wrangler.toml. */
  AUTH_DEV_BYPASS?: string;
  /** Zero Trust team domain (subdomain of *.cloudflareaccess.com). Required when Access is enforced. */
  ACCESS_TEAM_DOMAIN?: string;
  /** Access Application AUD tag (recommended). */
  ACCESS_AUD?: string;
  /** Method B: allow emails in this domain (Worker-side guard). */
  ACCESS_ALLOWED_EMAIL_DOMAIN?: string;
  /** Method A: comma-separated allowlist e.g. "a@x.com,b@x.com" (Worker-side guard). */
  ACCESS_ALLOWED_EMAILS?: string;
}

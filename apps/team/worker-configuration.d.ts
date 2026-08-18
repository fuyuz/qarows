/* eslint-disable */
// Generated from wrangler.toml.example bindings. Regenerate: bun run types:worker
declare namespace Cloudflare {
  interface Env {
    ASSETS: Fetcher;
    DB: D1Database;
    PROJECT: DurableObjectNamespace;
    AI?: Ai;
    ATTACHMENTS?: R2Bucket;
    ACCESS_TEAM_DOMAIN: string;
    ACCESS_AUD?: string;
    ACCESS_ALLOWED_EMAIL_DOMAIN?: string;
    ACCESS_ALLOWED_EMAILS?: string;
    AUTH_DEV_BYPASS?: string;
    AI_MODEL?: string;
    AI_MODEL_FALLBACK?: string;
  }
}

interface CloudflareEnv extends Cloudflare.Env {}

import type { ProjectRoom } from "./project-room";

export interface Env {
  ASSETS: Fetcher;
  DB: D1Database;
  PROJECT: DurableObjectNamespace<ProjectRoom>;
  /** Set to "true" in production to require Cloudflare Access headers. */
  ACCESS_REQUIRED?: string;
  /** Optional extra guard: reject Access users outside this email domain. */
  ACCESS_ALLOWED_EMAIL_DOMAIN?: string;
}

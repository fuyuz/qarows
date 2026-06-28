import type { ProjectRoom } from "./project-room";

export interface Env {
  ASSETS: Fetcher;
  DB: D1Database;
  PROJECT: DurableObjectNamespace<ProjectRoom>;
}

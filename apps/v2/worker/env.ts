import type { ProjectRoom } from "./project-room";

/** Worker bindings — extend generated CloudflareEnv with typed Durable Object namespace. */
export interface Env extends Omit<CloudflareEnv, "PROJECT"> {
  PROJECT: DurableObjectNamespace<ProjectRoom>;
}

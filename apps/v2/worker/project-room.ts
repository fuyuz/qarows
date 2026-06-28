import { DurableObject } from "cloudflare:workers";

/** Placeholder export for wrangler migrations; implemented in the next commit. */
export class ProjectRoom extends DurableObject {
  async ping(): Promise<string> {
    return "ok";
  }
}

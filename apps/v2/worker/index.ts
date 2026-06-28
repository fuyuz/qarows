/*    https://developers.cloudflare.com/workers/wrangler/configuration/    */
/*    https://developers.cloudflare.com/workers/examples/cors/    */

export { ProjectRoom } from "./project-room";

import { handleProjectsApi } from "./api/projects";
import type { Env } from "./env";
import { errorResponse, jsonResponse } from "./http";

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);

    if (url.pathname === "/api/health") {
      return jsonResponse({
        ok: true,
        service: "qarows-v2",
        phase: 2,
      });
    }

    if (url.pathname === "/api/me") {
      const { getAuthUser } = await import("./auth");
      return jsonResponse({ user: getAuthUser(request) });
    }

    const projectMatch = url.pathname.match(/^\/api\/projects\/([^/]+)(?:\/ws)?$/);
    const projectId = projectMatch?.[1];

    if (projectId && url.pathname.endsWith("/ws") && request.headers.get("Upgrade") === "websocket") {
      const stub = env.PROJECT.getByName(projectId);
      return stub.fetch(request);
    }

    const projectsResponse = await handleProjectsApi(request, env, projectId);
    if (projectsResponse) return projectsResponse;

    if (url.pathname.startsWith("/api/")) {
      return errorResponse("Not found", 404);
    }

    return env.ASSETS.fetch(request);
  },
} satisfies ExportedHandler<Env>;

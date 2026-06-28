/*    https://developers.cloudflare.com/workers/wrangler/configuration/    */
/*    https://developers.cloudflare.com/workers/examples/cors/    */

export interface Env {
  ASSETS: Fetcher;
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);

    if (url.pathname === "/api/health") {
      return Response.json({
        ok: true,
        service: "qarows-v2",
        phase: 2,
      });
    }

    return env.ASSETS.fetch(request);
  },
} satisfies ExportedHandler<Env>;

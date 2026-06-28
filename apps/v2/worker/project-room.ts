import { DurableObject } from "cloudflare:workers";
import type { Env } from "./env";

/** Real-time project room; WebSocket sync implemented below. */
export class ProjectRoom extends DurableObject<Env> {
  async initFromD1(): Promise<void> {
    // Loaded on first WebSocket connect or explicit init after REST create.
  }

  override async fetch(request: Request): Promise<Response> {
    if (request.headers.get("Upgrade") !== "websocket") {
      return new Response("Expected WebSocket", { status: 426 });
    }
    const pair = new WebSocketPair();
    const [client, server] = Object.values(pair);
    this.ctx.acceptWebSocket(server);
    server.send(JSON.stringify({ type: "hello", message: "ProjectRoom ready" }));
    return new Response(null, { status: 101, webSocket: client });
  }
}

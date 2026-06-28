/*    https://developers.cloudflare.com/workers/wrangler/configuration/    */

export { ProjectRoom } from "./project-room";

import { createApp } from "./app";

const app = createApp();

export default {
  fetch: app.fetch,
} satisfies ExportedHandler<import("./env").Env>;

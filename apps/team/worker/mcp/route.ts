import {
  createMcpHandler,
  hostHeaderValidationResponse,
  localhostAllowedHostnames,
  originValidationResponse,
} from "@modelcontextprotocol/server";
import type { Context } from "hono";
import { isAccessRequired } from "../auth";
import type { AppEnv } from "../types";
import { createQarowsMcpServer } from "./server";

export const MCP_PATH = "/mcp";

/**
 * MCP（Streamable HTTP, stateless）。認証は accessMiddleware 済み（MCP 専用ホストは
 * Managed OAuth を有効にした Access Application の JWT）。ここでは DNS rebinding /
 * ブラウザからの越境呼び出し対策として Host と Origin を MCP 専用ホストに限定する
 */
export async function handleMcp(c: Context<AppEnv>): Promise<Response> {
  const localDev = !isAccessRequired(c.env, c.req.raw);
  const mcpHost = c.env.MCP_HOSTNAME?.trim();
  const allowedHostnames = localDev ? localhostAllowedHostnames() : mcpHost ? [mcpHost] : [];

  const rejected =
    hostHeaderValidationResponse(c.req.raw, allowedHostnames) ??
    originValidationResponse(c.req.raw, allowedHostnames);
  if (rejected) return rejected;

  const user = c.get("user");
  const handler = createMcpHandler(() => createQarowsMcpServer({ env: c.env, user }));
  return handler.fetch(c.req.raw);
}

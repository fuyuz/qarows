import { McpServer } from "@modelcontextprotocol/server";
import { z } from "zod";
import type { AuthUser } from "../auth";
import type { Env } from "../env";

export interface McpToolContext {
  env: Env;
  /** Access で認証された利用者。書き込みの実施者・バグの起票者にもこのメールを使う */
  user: AuthUser;
}

function jsonResult(value: unknown) {
  return {
    content: [{ type: "text" as const, text: JSON.stringify(value, null, 2) }],
    structuredContent: value as Record<string, unknown>,
  };
}

/** 1 リクエストごとに作る MCP サーバー。ツールは許可した操作だけを固定で登録する */
export function createQarowsMcpServer({ user }: McpToolContext): McpServer {
  const server = new McpServer({ name: "qarows-team", version: "1.0.0" });

  server.registerTool(
    "whoami",
    {
      title: "Who am I",
      description: "Return the signed-in qarows user (the email recorded as executor for writes).",
      inputSchema: z.object({}),
      annotations: { readOnlyHint: true },
    },
    async () => jsonResult({ email: user.email }),
  );

  return server;
}

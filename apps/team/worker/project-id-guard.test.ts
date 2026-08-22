import { describe, expect, it } from "vitest";
import { createApp } from "./app";

const ENV = {
  AUTH_DEV_BYPASS: "true",
  DB: {
    prepare() {
      // listProjects は bind() を挟まずに all() を呼ぶ
      const statement = {
        bind: () => statement,
        first: async () => null,
        all: async () => ({ results: [] }),
        run: async () => ({ meta: { changes: 0 } }),
      };
      return statement;
    },
  } as never,
  PROJECT: {
    getByName() {
      throw new Error("DO must not be reached for an invalid projectId");
    },
  } as never,
  ASSETS: { fetch: async () => new Response("asset") } as never,
};

/**
 * ローカル wrangler 相当のオリジンでないと accessMiddleware に落とされる。
 * AUTH_DEV_BYPASS が効くと csrfMiddleware も Origin を要求しない
 */
function request(path: string, init?: RequestInit): Request {
  return new Request(`http://localhost:8787${path}`, {
    headers: { "X-Qarows-User": "qa@example.com", ...(init?.headers ?? {}) },
    ...init,
  });
}

/** ".." 系は URL 正規化で別パスになり 404 になるので、ここには入れない */
const INVALID = [
  "a%2Fb",
  "a b",
  encodeURIComponent("../secret"),
  encodeURIComponent("プロジェクト"),
  "-leading-hyphen",
  "_leading-underscore",
  "a".repeat(65),
];

describe("projectId validation", () => {
  const app = createApp();

  it("rejects ids that are not allowed as a Durable Object name", async () => {
    for (const projectId of INVALID) {
      for (const path of [
        `/api/projects/${projectId}`,
        `/api/projects/${projectId}/ws`,
        `/api/projects/${projectId}/attachments`,
        `/api/projects/${projectId}/ai/propose`,
      ]) {
        const response = await app.fetch(request(path), ENV);
        expect(response.status, path).toBe(400);
      }
    }
  });

  it("lets a valid id reach the handler", async () => {
    // 行なしの DB スタブなので、通れば handler の 404 になる
    for (const projectId of ["demo-1_A", "a", "a".repeat(64)]) {
      const response = await app.fetch(request(`/api/projects/${projectId}`), ENV);
      expect(response.status, projectId).toBe(404);
    }
  });

  it("does not affect the collection routes", async () => {
    expect((await app.fetch(request("/api/projects"), ENV)).status).toBe(200);
    // POST は body 不足で handler 自身の 400 になる（middleware の 400 ではない）
    const created = await app.fetch(
      request("/api/projects", { method: "POST", body: "" }),
      ENV,
    );
    expect(created.status).toBe(400);
    expect(await created.json()).toMatchObject({ error: expect.not.stringContaining("projectId") });
  });
});

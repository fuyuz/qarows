import { describe, expect, it } from "vitest";
import {
  AccessDeniedError,
  assertMutatingRequestOrigin,
  assertWebSocketOrigin,
  isAccessRequired,
  isLocalDevWorkerRequest,
} from "./auth";
import type { Env } from "./env";

const bypassEnv = { AUTH_DEV_BYPASS: "true" } as Env;
const prodEnv = { AUTH_DEV_BYPASS: "false" } as Env;

describe("isAccessRequired", () => {
  it("requires access when bypass is not set", () => {
    const request = new Request("http://127.0.0.1:8787/api/me");
    expect(isAccessRequired({} as Env, request)).toBe(true);
  });

  it("allows bypass only on local wrangler host", () => {
    const local = new Request("http://127.0.0.1:8787/api/me");
    const remote = new Request("https://qarows.example.com/api/me");
    expect(isAccessRequired(bypassEnv, local)).toBe(false);
    expect(isAccessRequired(bypassEnv, remote)).toBe(true);
  });

  it("fails closed when request is omitted even with bypass", () => {
    expect(isAccessRequired(bypassEnv)).toBe(true);
  });
});

describe("isLocalDevWorkerRequest", () => {
  it("matches wrangler default host/port", () => {
    expect(isLocalDevWorkerRequest(new Request("http://localhost:8787/"))).toBe(true);
    expect(isLocalDevWorkerRequest(new Request("http://127.0.0.1:8787/"))).toBe(true);
  });

  it("rejects non-local hosts", () => {
    expect(isLocalDevWorkerRequest(new Request("https://example.workers.dev/"))).toBe(false);
  });
});

describe("assertWebSocketOrigin", () => {
  it("allows matching origin including scheme", () => {
    const request = new Request("https://qarows.example.com/api/projects/x/ws", {
      headers: { Origin: "https://qarows.example.com" },
    });
    expect(() => assertWebSocketOrigin(request)).not.toThrow();
  });

  it("rejects http origin against https request", () => {
    const request = new Request("https://qarows.example.com/api/projects/x/ws", {
      headers: { Origin: "http://qarows.example.com" },
    });
    expect(() => assertWebSocketOrigin(request)).toThrow(AccessDeniedError);
  });

  it("rejects mismatched host", () => {
    const request = new Request("https://qarows.example.com/api/projects/x/ws", {
      headers: { Origin: "https://evil.example.com" },
    });
    expect(() => assertWebSocketOrigin(request)).toThrow(AccessDeniedError);
  });

  it("allows missing Origin header", () => {
    const request = new Request("https://qarows.example.com/api/projects/x/ws");
    expect(() => assertWebSocketOrigin(request)).not.toThrow();
  });

  it("allows Vite dev proxy origin when auth dev bypass is enabled on local worker", () => {
    const request = new Request("http://127.0.0.1:8787/api/projects/x/ws", {
      headers: { Origin: "http://localhost:5177" },
    });
    expect(() => assertWebSocketOrigin(request, bypassEnv)).not.toThrow();
  });

  it("rejects non-localhost dev origins even with auth dev bypass", () => {
    const request = new Request("http://127.0.0.1:8787/api/projects/x/ws", {
      headers: { Origin: "http://evil.example.com" },
    });
    expect(() => assertWebSocketOrigin(request, bypassEnv)).toThrow(AccessDeniedError);
  });

  it("rejects Vite dev origin in production mode", () => {
    const request = new Request("http://127.0.0.1:8787/api/projects/x/ws", {
      headers: { Origin: "http://localhost:5177" },
    });
    expect(() => assertWebSocketOrigin(request, prodEnv)).toThrow(AccessDeniedError);
  });
});

describe("assertMutatingRequestOrigin", () => {
  it("allows same-origin POST", () => {
    const request = new Request("https://qarows.example.com/api/projects/x/clear-results", {
      method: "POST",
      headers: { Origin: "https://qarows.example.com" },
    });
    expect(() => assertMutatingRequestOrigin(request, prodEnv)).not.toThrow();
  });

  it("rejects cross-origin POST", () => {
    const request = new Request("https://qarows.example.com/api/projects/x/clear-results", {
      method: "POST",
      headers: { Origin: "https://evil.example.com" },
    });
    expect(() => assertMutatingRequestOrigin(request, prodEnv)).toThrow(AccessDeniedError);
  });

  it("rejects missing Origin in production", () => {
    const request = new Request("https://qarows.example.com/api/projects/x/clear-results", {
      method: "POST",
    });
    expect(() => assertMutatingRequestOrigin(request, prodEnv)).toThrow(AccessDeniedError);
  });

  it("allows missing Origin with Sec-Fetch-Site same-origin", () => {
    const request = new Request("https://qarows.example.com/api/projects/x/clear-results", {
      method: "POST",
      headers: { "Sec-Fetch-Site": "same-origin" },
    });
    expect(() => assertMutatingRequestOrigin(request, prodEnv)).not.toThrow();
  });

  it("allows missing Origin on local bypass for curl/tests", () => {
    const request = new Request("http://127.0.0.1:8787/api/projects", { method: "POST" });
    expect(() => assertMutatingRequestOrigin(request, bypassEnv)).not.toThrow();
  });

  it("allows Vite origin on local bypass", () => {
    const request = new Request("http://127.0.0.1:8787/api/projects", {
      method: "POST",
      headers: { Origin: "http://localhost:5177" },
    });
    expect(() => assertMutatingRequestOrigin(request, bypassEnv)).not.toThrow();
  });
});

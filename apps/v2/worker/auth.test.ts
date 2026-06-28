import { describe, expect, it } from "vitest";
import { AccessDeniedError, assertWebSocketOrigin } from "./auth";
import type { Env } from "./env";

const devEnv = { AUTH_DEV_BYPASS: "true" } as Env;

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

  it("allows Vite dev proxy origin when auth dev bypass is enabled", () => {
    const request = new Request("http://127.0.0.1:8787/api/projects/x/ws", {
      headers: { Origin: "http://localhost:5177" },
    });
    expect(() => assertWebSocketOrigin(request, devEnv)).not.toThrow();
  });

  it("rejects non-localhost dev origins even with auth dev bypass", () => {
    const request = new Request("http://127.0.0.1:8787/api/projects/x/ws", {
      headers: { Origin: "http://evil.example.com" },
    });
    expect(() => assertWebSocketOrigin(request, devEnv)).toThrow(AccessDeniedError);
  });

  it("rejects Vite dev origin in production mode", () => {
    const request = new Request("http://127.0.0.1:8787/api/projects/x/ws", {
      headers: { Origin: "http://localhost:5177" },
    });
    const prodEnv = { AUTH_DEV_BYPASS: "false" } as Env;
    expect(() => assertWebSocketOrigin(request, prodEnv)).toThrow(AccessDeniedError);
  });
});

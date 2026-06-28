import { describe, expect, it } from "vitest";
import { AccessDeniedError, assertWebSocketOrigin } from "./auth";

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
});

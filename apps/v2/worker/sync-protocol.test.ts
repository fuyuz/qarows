import { describe, expect, it } from "vitest";
import { makeDefinition } from "@qarows/shared/test-fixtures";
import {
  MAX_WS_MESSAGE_BYTES,
  SYNC_PING_MESSAGE,
  SYNC_PONG_MESSAGE,
  parseClientMessage,
} from "./sync-protocol";

describe("sync-protocol", () => {
  it("exports ping/pong wire messages", () => {
    expect(SYNC_PING_MESSAGE).toBe('{"type":"ping"}');
    expect(SYNC_PONG_MESSAGE).toBe('{"type":"pong"}');
  });

  it("parses ping", () => {
    expect(parseClientMessage(SYNC_PING_MESSAGE)).toEqual({ type: "ping" });
  });

  it("parses updateResult command", () => {
    const raw = JSON.stringify({
      type: "command",
      generation: "gen-1",
      commandId: "cmd-1",
      command: {
        type: "updateResult",
        testCaseId: "TC-001",
        envId: "chrome",
        entry: {
          status: "OK",
          executedAt: "2026-06-28T12:00:00.000Z",
          executedBy: "qa@example.com",
          version: 1,
        },
      },
    });

    const parsed = parseClientMessage(raw);
    expect(parsed?.type).toBe("command");
    if (parsed?.type === "command") {
      expect(parsed.commandId).toBe("cmd-1");
      expect(parsed.command.type).toBe("updateResult");
    }
  });

  it("parses setSession command", () => {
    const raw = JSON.stringify({
      type: "command",
      generation: "gen-1",
      commandId: "cmd-session",
      command: {
        type: "setSession",
        session: { executorName: "Alice", selectedEnvironmentIds: ["chrome"] },
      },
    });

    const parsed = parseClientMessage(raw);
    expect(parsed?.type).toBe("command");
  });

  it("rejects command without generation", () => {
    const raw = JSON.stringify({
      type: "command",
      commandId: "cmd-1",
      command: {
        type: "setSession",
        session: { executorName: "Alice", selectedEnvironmentIds: ["chrome"] },
      },
    });
    expect(parseClientMessage(raw)).toBeNull();
  });

  it("rejects command without commandId", () => {
    const raw = JSON.stringify({
      type: "command",
      generation: "gen-1",
      command: {
        type: "setSession",
        session: { executorName: "Alice", selectedEnvironmentIds: ["chrome"] },
      },
    });
    expect(parseClientMessage(raw)).toBeNull();
  });

  it("rejects invalid command payload", () => {
    const raw = JSON.stringify({
      type: "command",
      generation: "gen-1",
      commandId: "cmd-bad",
      command: { type: "unknown" },
    });
    expect(parseClientMessage(raw)).toBeNull();
  });

  it("rejects mergeResults from WebSocket", () => {
    const raw = JSON.stringify({
      type: "command",
      generation: "gen-1",
      commandId: "cmd-merge",
      command: {
        type: "mergeResults",
        incoming: { version: 1, projectId: "test", updatedAt: "", results: {}, bugs: [] },
      },
    });
    expect(parseClientMessage(raw)).toBeNull();
  });

  it("rejects oversized messages", () => {
    const raw = "x".repeat(MAX_WS_MESSAGE_BYTES + 1);
    expect(parseClientMessage(raw)).toBeNull();
  });

  it("rejects malformed JSON", () => {
    expect(parseClientMessage("{")).toBeNull();
  });

  it("rejects unknown message type", () => {
    expect(parseClientMessage(JSON.stringify({ type: "patch" }))).toBeNull();
  });

  it("accepts updateResultsBatch from real definition shape", () => {
    const definition = makeDefinition();
    const raw = JSON.stringify({
      type: "command",
      generation: "gen-1",
      commandId: "cmd-batch",
      command: {
        type: "updateResultsBatch",
        testCaseId: definition.testCases[0]!.id,
        envIds: ["chrome"],
        partial: { status: "NG", memo: "layout broken" },
      },
    });
    expect(parseClientMessage(raw)?.type).toBe("command");
  });
});

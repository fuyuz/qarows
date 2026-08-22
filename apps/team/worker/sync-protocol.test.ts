import { describe, expect, it } from "vitest";
import { makeDefinition } from "@qarows/shared/test-fixtures";
import {
  MAX_WS_MESSAGE_BYTES,
  SYNC_PING_MESSAGE,
  SYNC_PONG_MESSAGE,
  exceedsMaxWsMessageBytes,
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

  it("parses resync", () => {
    expect(parseClientMessage(JSON.stringify({ type: "resync" }))).toEqual({ type: "resync" });
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
        session: { selectedEnvironmentIds: ["chrome"] },
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
        incoming: { version: 1, projectId: "test", updatedAt: "", results: {}, memos: {}, bugs: [] },
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
        partial: { status: "NG" },
      },
    });
    expect(parseClientMessage(raw)?.type).toBe("command");
  });

  it("accepts updateTestMemo", () => {
    const definition = makeDefinition();
    const raw = JSON.stringify({
      type: "command",
      generation: "gen-1",
      commandId: "cmd-memo",
      command: {
        type: "updateTestMemo",
        testCaseId: definition.testCases[0]!.id,
        memo: "shared note",
      },
    });
    expect(parseClientMessage(raw)?.type).toBe("command");
  });
  it("returns the sanitized command, not the raw client payload", () => {
    const raw = JSON.stringify({
      type: "command",
      generation: "gen-1",
      commandId: "cmd-sanitize",
      unknownEnvelopeField: "drop me",
      command: {
        type: "addBug",
        bug: {
          id: "BUG-1",
          title: "crash",
          severity: "high",
          status: "open",
          attachments: [
            {
              key: "0189BD6C-1F2E-4A3B-8C4D-5E6F7A8B9C0D",
              name: "shot.png",
              size: 12,
              mimeType: "image/png",
            },
          ],
          injected: "drop me too",
        },
      },
    });

    // 生の payload が DO 状態・broadcast・D1 に流れないこと（key は正規化される）
    expect(parseClientMessage(raw)).toEqual({
      type: "command",
      generation: "gen-1",
      commandId: "cmd-sanitize",
      command: {
        type: "addBug",
        bug: {
          id: "BUG-1",
          title: "crash",
          severity: "high",
          status: "open",
          attachments: [
            {
              key: "0189bd6c-1f2e-4a3b-8c4d-5e6f7a8b9c0d",
              name: "shot.png",
              size: 12,
              mimeType: "image/png",
              uploadedAt: undefined,
              uploadedBy: undefined,
            },
          ],
        },
      },
    });
  });

  it("measures the size limit in UTF-8 bytes, not UTF-16 code units", () => {
    // 日本語は 1 文字 3 バイト。length 比較だと上限の約 3 倍まで通っていた
    const japanese = "あ".repeat(Math.floor(MAX_WS_MESSAGE_BYTES / 3) + 1);
    expect(japanese.length).toBeLessThan(MAX_WS_MESSAGE_BYTES);
    expect(exceedsMaxWsMessageBytes(japanese)).toBe(true);
  });

  it("accepts ascii payloads up to the limit exactly", () => {
    expect(exceedsMaxWsMessageBytes("a".repeat(MAX_WS_MESSAGE_BYTES))).toBe(false);
    expect(exceedsMaxWsMessageBytes("a".repeat(MAX_WS_MESSAGE_BYTES + 1))).toBe(true);
  });

  it("counts surrogate pairs by their real byte length", () => {
    // 絵文字は UTF-16 で 2 code unit / UTF-8 で 4 バイト
    const emoji = "😀".repeat(MAX_WS_MESSAGE_BYTES / 4);
    expect(exceedsMaxWsMessageBytes(emoji)).toBe(false);
    expect(exceedsMaxWsMessageBytes(emoji + "😀")).toBe(true);
  });

  /**
   * transport 上限がフィールド上限より厳しいと、各項目は正当なのに
   * コマンド全体が拒否される。日本語の長いバグ報告で現実に起こるので固定する
   */
  it("accepts the largest field-valid addBug", () => {
    const ja = (count: number) => "あ".repeat(count);
    const raw = JSON.stringify({
      type: "command",
      generation: "g".repeat(64),
      commandId: "c".repeat(64),
      command: {
        type: "addBug",
        bug: {
          id: "B".repeat(128),
          title: ja(8192),
          severity: "critical",
          status: "open",
          testCaseId: "TC-001",
          assignee: ja(512),
          environmentIds: Array.from({ length: 64 }, (_, index) => `env-${index}`),
          steps: ja(8192),
          expected: ja(8192),
          actual: ja(8192),
          fixNote: ja(8192),
          memo: ja(8192),
        },
      },
    });

    expect(exceedsMaxWsMessageBytes(raw)).toBe(false);
    expect(parseClientMessage(raw)?.type).toBe("command");
  });
});

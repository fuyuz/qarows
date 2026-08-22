import { describe, expect, it } from "vitest";
import { makeDefinition } from "@qarows/shared/test-fixtures";
import { parseClientProjectCommand, parseProjectCommand } from "./parse-project-command";

describe("parseClientProjectCommand", () => {
  it("accepts updateResult", () => {
    const cmd = parseClientProjectCommand({
      type: "updateResult",
      testCaseId: "TC-001",
      envId: "chrome",
      entry: { status: "OK", executedAt: "2026-06-28T12:00:00.000Z" },
    });
    expect(cmd?.type).toBe("updateResult");
  });

  it("accepts setSession without executorName", () => {
    const cmd = parseClientProjectCommand({
      type: "setSession",
      session: { selectedEnvironmentIds: ["chrome"] },
    });
    expect(cmd).toEqual({
      type: "setSession",
      session: { executorName: "", selectedEnvironmentIds: ["chrome"] },
    });
  });

  it("rejects mergeResults from client", () => {
    expect(
      parseClientProjectCommand({
        type: "mergeResults",
        incoming: { version: 1, projectId: "x", updatedAt: "", results: {}, memos: {}, bugs: [] },
      }),
    ).toBeNull();
  });

  it("rejects replaceSnapshot from client", () => {
    const definition = makeDefinition();
    expect(
      parseClientProjectCommand({
        type: "replaceSnapshot",
        definition,
        results: { version: 1, projectId: "test", updatedAt: "", results: {}, memos: {}, bugs: [] },
        session: null,
      }),
    ).toBeNull();
  });

  it("rejects clearResults from client", () => {
    expect(parseClientProjectCommand({ type: "clearResults" })).toBeNull();
  });

  it("rejects invalid bug payload", () => {
    expect(parseClientProjectCommand({ type: "addBug", bug: { id: "BUG-1", title: "" } })).toBeNull();
  });

  it("rejects legacy pending_verification bug status", () => {
    expect(
      parseClientProjectCommand({
        type: "addBug",
        bug: { id: "BUG-1", title: "x", severity: "medium", status: "pending_verification" },
      }),
    ).toBeNull();
  });

  it("keeps bug attachment metadata through addBug", () => {
    const attachment = {
      key: "0189bd6c-1f2e-4a3b-8c4d-5e6f7a8b9c0d",
      name: "shot.png",
      size: 1234,
      mimeType: "image/png",
      uploadedAt: "2026-06-28T12:00:00.000Z",
      uploadedBy: "qa@example.com",
    };
    const cmd = parseClientProjectCommand({
      type: "addBug",
      bug: {
        id: "BUG-1",
        title: "crash",
        severity: "high",
        status: "open",
        attachments: [attachment],
      },
    });
    expect(cmd).toEqual({
      type: "addBug",
      bug: {
        id: "BUG-1",
        title: "crash",
        severity: "high",
        status: "open",
        attachments: [attachment],
      },
    });
  });

  it("keeps bug attachment metadata through updateBug", () => {
    const cmd = parseClientProjectCommand({
      type: "updateBug",
      bug: {
        id: "BUG-1",
        title: "crash",
        severity: "high",
        status: "open",
        attachments: [
          {
            key: "0189BD6C-1F2E-4A3B-8C4D-5E6F7A8B9C0D",
            name: "clip.mp4",
            size: 2048,
            mimeType: "video/mp4",
          },
        ],
      },
    });
    expect(cmd?.type).toBe("updateBug");
    expect(cmd?.type === "updateBug" ? cmd.bug.attachments : undefined).toEqual([
      {
        key: "0189bd6c-1f2e-4a3b-8c4d-5e6f7a8b9c0d",
        name: "clip.mp4",
        size: 2048,
        mimeType: "video/mp4",
        uploadedAt: undefined,
        uploadedBy: undefined,
      },
    ]);
  });

  it("drops invalid attachment entries but keeps the valid ones", () => {
    const cmd = parseClientProjectCommand({
      type: "addBug",
      bug: {
        id: "BUG-1",
        title: "crash",
        severity: "high",
        status: "open",
        attachments: [
          { key: "../../etc/passwd", name: "x", size: 1, mimeType: "image/png" },
          { key: "0189bd6c-1f2e-4a3b-8c4d-5e6f7a8b9c0d", name: "x.svg", size: 1, mimeType: "image/svg+xml" },
          { key: "0189bd6c-1f2e-4a3b-8c4d-5e6f7a8b9c0e", name: "ok.png", size: 7, mimeType: "image/png" },
        ],
      },
    });
    expect(cmd?.type === "addBug" ? cmd.bug.attachments : undefined).toEqual([
      {
        key: "0189bd6c-1f2e-4a3b-8c4d-5e6f7a8b9c0e",
        name: "ok.png",
        size: 7,
        mimeType: "image/png",
        uploadedAt: undefined,
        uploadedBy: undefined,
      },
    ]);
  });

  it("caps attachment uploadedAt / uploadedBy length", () => {
    const cmd = parseClientProjectCommand({
      type: "addBug",
      bug: {
        id: "BUG-1",
        title: "crash",
        severity: "high",
        status: "open",
        attachments: [
          {
            key: "0189bd6c-1f2e-4a3b-8c4d-5e6f7a8b9c0d",
            name: "ok.png",
            size: 7,
            mimeType: "image/png",
            uploadedAt: "z".repeat(500),
            uploadedBy: "u".repeat(1000),
          },
        ],
      },
    });
    const attachment = cmd?.type === "addBug" ? cmd.bug.attachments?.[0] : undefined;
    expect(attachment?.uploadedAt).toHaveLength(64);
    expect(attachment?.uploadedBy).toHaveLength(320);
  });

  it("strips unknown bug fields instead of passing them through", () => {
    const cmd = parseClientProjectCommand({
      type: "addBug",
      bug: {
        id: "BUG-1",
        title: "crash",
        severity: "high",
        status: "open",
        injected: "should not survive",
      },
    });
    expect(cmd).toEqual({
      type: "addBug",
      bug: { id: "BUG-1", title: "crash", severity: "high", status: "open" },
    });
  });

  it("rejects oversized test memo", () => {
    expect(
      parseClientProjectCommand({
        type: "updateTestMemo",
        testCaseId: "TC-001",
        memo: "x".repeat(9000),
      }),
    ).toBeNull();
  });

  it("accepts updateTestMemo", () => {
    expect(
      parseClientProjectCommand({
        type: "updateTestMemo",
        testCaseId: "TC-001",
        memo: "note",
      }),
    ).toEqual({
      type: "updateTestMemo",
      testCaseId: "TC-001",
      memo: "note",
    });
  });
});

describe("parseProjectCommand", () => {
  it("still accepts internal mergeResults shape", () => {
    const cmd = parseProjectCommand({
      type: "mergeResults",
      incoming: { version: 1, projectId: "test", updatedAt: "", results: {}, memos: {}, bugs: [] },
    });
    expect(cmd?.type).toBe("mergeResults");
  });
});

import { describe, expect, it } from "vitest";
import {
  BodyTooLargeError,
  MAX_TESTS_YAML_BYTES,
  readRequestTextWithLimit,
} from "./request-body";

function requestWithBody(body: string, contentLength?: string): Request {
  const headers = new Headers();
  if (contentLength !== undefined) {
    headers.set("Content-Length", contentLength);
  }
  return new Request("http://localhost/api/projects", {
    method: "POST",
    headers,
    body,
  });
}

describe("readRequestTextWithLimit", () => {
  it("returns text within limit", async () => {
    const text = await readRequestTextWithLimit(requestWithBody("hello"), 100);
    expect(text).toBe("hello");
  });

  it("rejects Content-Length over limit", async () => {
    await expect(
      readRequestTextWithLimit(
        requestWithBody("", String(MAX_TESTS_YAML_BYTES + 1)),
        MAX_TESTS_YAML_BYTES,
      ),
    ).rejects.toBeInstanceOf(BodyTooLargeError);
  });

  it("rejects streamed body over limit", async () => {
    const oversized = "x".repeat(MAX_TESTS_YAML_BYTES + 1);
    await expect(
      readRequestTextWithLimit(requestWithBody(oversized), MAX_TESTS_YAML_BYTES),
    ).rejects.toBeInstanceOf(BodyTooLargeError);
  });
});

import { describe, expect, it } from "vitest";
import {
  attachmentCacheKey,
  attachmentKeyFromObjectKey,
  attachmentObjectKey,
  attachmentPrefix,
  purgeAttachmentCache,
} from "./attachments";

const PROJECT_ID = "demo";
const KEY = "0189bd6c-1f2e-4a3b-8c4d-5e6f7a8b9c0d";

describe("attachmentKeyFromObjectKey", () => {
  it("round-trips attachmentObjectKey", () => {
    expect(attachmentKeyFromObjectKey(PROJECT_ID, attachmentObjectKey(PROJECT_ID, KEY))).toBe(KEY);
  });

  it("rejects keys outside the project prefix", () => {
    expect(attachmentKeyFromObjectKey(PROJECT_ID, attachmentObjectKey("other", KEY))).toBeNull();
    expect(attachmentKeyFromObjectKey(PROJECT_ID, attachmentPrefix(PROJECT_ID))).toBeNull();
  });
});

describe("attachmentCacheKey", () => {
  it("builds the canonical delivery URL regardless of the request path", () => {
    // 配信は GET /:projectId/attachments/:key、purge はプロジェクト DELETE から呼ばれる
    const fromDelivery = attachmentCacheKey(
      `https://qa.example.com/api/projects/${PROJECT_ID}/attachments/${KEY}`,
      PROJECT_ID,
      KEY,
    );
    const fromProjectDelete = attachmentCacheKey(
      `https://qa.example.com/api/projects/${PROJECT_ID}`,
      PROJECT_ID,
      KEY,
    );

    expect(fromDelivery.url).toBe(fromProjectDelete.url);
    expect(fromDelivery.url).toBe(
      `https://qa.example.com/api/projects/${PROJECT_ID}/attachments/${KEY}`,
    );
    expect(fromDelivery.method).toBe("GET");
  });

  it("ignores the query string and path form of the incoming request", () => {
    const canonical = attachmentCacheKey(
      `https://qa.example.com/api/projects/${PROJECT_ID}/attachments/${KEY}`,
      PROJECT_ID,
      KEY,
    );
    // GET は requireValidKey で小文字化した key を渡すため、大文字要求でも同じエントリになる
    const upperRequest = attachmentCacheKey(
      `https://qa.example.com/api/projects/${PROJECT_ID}/attachments/${KEY.toUpperCase()}?download=1`,
      PROJECT_ID,
      KEY,
    );

    expect(upperRequest.url).toBe(canonical.url);
  });
});

describe("purgeAttachmentCache", () => {
  function withFakeCache(): { deleted: string[]; restore: () => void } {
    const deleted: string[] = [];
    const original = (globalThis as { caches?: unknown }).caches;
    (globalThis as { caches?: unknown }).caches = {
      default: {
        async delete(request: Request) {
          deleted.push(request.url);
          return true;
        },
      },
    };
    return {
      deleted,
      restore: () => {
        (globalThis as { caches?: unknown }).caches = original;
      },
    };
  }

  const requestUrl = `https://qa.example.com/api/projects/${PROJECT_ID}`;

  it("purges the delivery URL of every listed object", async () => {
    const cache = withFakeCache();
    try {
      await purgeAttachmentCache(requestUrl, PROJECT_ID, [
        { key: attachmentObjectKey(PROJECT_ID, KEY) },
        { key: attachmentObjectKey(PROJECT_ID, "0189bd6c-1f2e-4a3b-8c4d-5e6f7a8b9c0e") },
      ]);
      expect(cache.deleted).toEqual([
        `https://qa.example.com/api/projects/${PROJECT_ID}/attachments/${KEY}`,
        `https://qa.example.com/api/projects/${PROJECT_ID}/attachments/0189bd6c-1f2e-4a3b-8c4d-5e6f7a8b9c0e`,
      ]);
    } finally {
      cache.restore();
    }
  });

  it("skips keys that are not server-generated UUIDs", async () => {
    const cache = withFakeCache();
    try {
      // 手動で置かれた R2 キー。正規化で /api/foo のような無関係な URL を purge しかねない
      await purgeAttachmentCache(requestUrl, PROJECT_ID, [
        { key: `${attachmentPrefix(PROJECT_ID)}../../../foo` },
        { key: `${attachmentPrefix(PROJECT_ID)}not-a-uuid` },
        { key: attachmentObjectKey("other-project", KEY) },
      ]);
      expect(cache.deleted).toEqual([]);
    } finally {
      cache.restore();
    }
  });
});

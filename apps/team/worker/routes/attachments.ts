import {
  MAX_ATTACHMENT_BYTES,
  PROJECT_ID_PATTERN,
  isAllowedAttachmentMimeType,
  isValidAttachmentKey,
  type AttachmentMimeType,
  type BugAttachment,
} from "@qarows/shared";
import { Hono } from "hono";
import type { Context } from "hono";
import {
  SNIFF_HEAD_BYTES,
  attachmentCacheKey,
  attachmentObjectKey,
  encodeContentDispositionFilename,
  generateAttachmentKey,
  parseRangeHeader,
  sniffMatchesMimeType,
} from "../attachments";
import { getProject } from "../db";
import { apiError } from "../i18n";
import type { AppEnv } from "../types";

const IMMUTABLE_BROWSER_CACHE = "private, max-age=31536000, immutable";
const IMMUTABLE_EDGE_CACHE = "public, max-age=31536000, immutable";

function requireBucket(c: Context<AppEnv>): R2Bucket {
  const bucket = c.env.ATTACHMENTS;
  if (!bucket) apiError(c, 404, "api.attachmentsNotEnabled");
  return bucket;
}

/** R2 キーに使う前に必ず通す。通らなければ R2 に触れずに 400 */
function requireValidProjectId(c: Context<AppEnv>): string {
  const projectId = c.req.param("projectId") ?? "";
  if (!PROJECT_ID_PATTERN.test(projectId)) {
    apiError(c, 400, "api.invalidProjectId");
  }
  return projectId;
}

function requireValidKey(c: Context<AppEnv>): string {
  const key = (c.req.param("key") ?? "").toLowerCase();
  if (!isValidAttachmentKey(key)) {
    apiError(c, 400, "api.invalidAttachmentKey");
  }
  return key;
}

function decodeUploadFilename(raw: string | undefined): string {
  if (!raw) return "";
  try {
    // ヘッダ経由のため URI エンコードで受ける。制御文字は落とす
    return decodeURIComponent(raw).replace(/[\p{Cc}]/gu, "").slice(0, 255);
  } catch {
    return "";
  }
}

/** 配信・キャッシュ共通のレスポンスヘッダ。実行コンテキストを sandbox で殺しておく */
function attachmentHeaders(object: R2Object, mimeType: string, filename: string): Headers {
  const headers = new Headers();
  headers.set("Content-Type", mimeType);
  headers.set("ETag", object.httpEtag);
  headers.set("Accept-Ranges", "bytes");
  headers.set("Content-Security-Policy", "sandbox");
  headers.set("X-Content-Type-Options", "nosniff");
  headers.set("Content-Disposition", encodeContentDispositionFilename(filename));
  return headers;
}

export const attachmentsRoutes = new Hono<AppEnv>();

attachmentsRoutes.post("/:projectId/attachments", async (c) => {
  const bucket = requireBucket(c);
  const projectId = requireValidProjectId(c);

  const snapshot = await getProject(c.env.DB, projectId);
  if (!snapshot) apiError(c, 404, "api.projectNotFound");

  const mimeType = (c.req.header("Content-Type") ?? "").split(";")[0]!.trim();
  if (!isAllowedAttachmentMimeType(mimeType)) {
    apiError(c, 415, "api.attachmentUnsupportedType");
  }

  const contentLengthRaw = c.req.header("Content-Length");
  const contentLength = Number(contentLengthRaw);
  if (!contentLengthRaw || !Number.isInteger(contentLength) || contentLength <= 0) {
    apiError(c, 411, "api.attachmentContentLengthRequired");
  }
  if (contentLength > MAX_ATTACHMENT_BYTES) {
    apiError(c, 413, "api.attachmentTooLargeWithLimit", { maxBytes: MAX_ATTACHMENT_BYTES });
  }

  // zip import の往復用: results.json が参照する既存キーを維持できる。UUID 形式のみ許可
  const requestedKey = c.req.header("X-Attachment-Key")?.toLowerCase();
  let key: string;
  if (requestedKey != null) {
    if (!isValidAttachmentKey(requestedKey)) {
      apiError(c, 400, "api.invalidAttachmentKey");
    }
    if (await bucket.head(attachmentObjectKey(projectId, requestedKey))) {
      apiError(c, 409, "api.attachmentAlreadyExists");
    }
    key = requestedKey;
  } else {
    key = generateAttachmentKey();
  }

  const filename = decodeUploadFilename(c.req.header("X-Attachment-Filename"));
  const body = c.req.raw.body;
  if (!body) apiError(c, 400, "api.requestBodyRequired");

  // 先頭バイトのマジックナンバーで申告 MIME を検証してから R2 へストリームする。
  // FixedLengthStream 経由なので途中切断・長さ超過は put が失敗し、部分オブジェクトは残らない。
  const reader = body.getReader();
  const headChunks: Uint8Array[] = [];
  let headBytes = 0;
  let readerDone = false;
  while (headBytes < SNIFF_HEAD_BYTES) {
    const { done, value } = await reader.read();
    if (done) {
      readerDone = true;
      break;
    }
    headChunks.push(value);
    headBytes += value.byteLength;
  }
  const head = new Uint8Array(headBytes);
  let offset = 0;
  for (const chunk of headChunks) {
    head.set(chunk, offset);
    offset += chunk.byteLength;
  }
  if (!sniffMatchesMimeType(head, mimeType as AttachmentMimeType)) {
    await reader.cancel().catch(() => {});
    apiError(c, 400, "api.attachmentContentMismatch");
  }

  const objectKey = attachmentObjectKey(projectId, key);
  const fixed = new FixedLengthStream(contentLength);
  const putPromise = bucket.put(objectKey, fixed.readable, {
    httpMetadata: { contentType: mimeType },
    customMetadata: {
      filename: encodeURIComponent(filename),
      uploadedBy: c.get("user").email,
      projectId,
    },
  });

  const writer = fixed.writable.getWriter();
  let received = headBytes;
  let pumpError: unknown = null;
  try {
    for (const chunk of headChunks) {
      await writer.write(chunk);
    }
    while (!readerDone) {
      const { done, value } = await reader.read();
      if (done) {
        readerDone = true;
        break;
      }
      received += value.byteLength;
      if (received > contentLength) {
        throw new Error("Body exceeds declared Content-Length");
      }
      await writer.write(value);
    }
    await writer.close();
  } catch (err) {
    pumpError = err;
    await writer.abort(err).catch(() => {});
  }

  try {
    await putPromise;
  } catch (err) {
    console.error(`[${c.get("requestId")}] Attachment upload failed`, pumpError ?? err);
    apiError(c, 400, "api.attachmentUploadFailed");
  }
  if (pumpError) {
    // put が成功していても長さ不一致は不正とみなし、オブジェクトを残さない
    await bucket.delete(objectKey).catch(() => {});
    console.error(`[${c.get("requestId")}] Attachment upload failed`, pumpError);
    apiError(c, 400, "api.attachmentUploadFailed");
  }

  const attachment: BugAttachment = {
    key,
    name: filename || `attachment`,
    size: contentLength,
    mimeType,
    uploadedAt: new Date().toISOString(),
    uploadedBy: c.get("user").email,
  };
  return c.json({ attachment }, 201);
});

attachmentsRoutes.get("/:projectId/attachments/:key", async (c) => {
  const bucket = requireBucket(c);
  const projectId = requireValidProjectId(c);
  const key = requireValidKey(c);

  const objectKey = attachmentObjectKey(projectId, key);
  const rangeHeader = c.req.header("Range");

  // 存在確認は必ず R2 に問い合わせる。caches.default.delete() は呼び出し元の colo
  // だけを purge するため、キャッシュを先に見ると削除済み添付が他 colo で
  // max-age=31536000 のまま配信され続ける
  const headObject = await bucket.head(objectKey);
  if (!headObject) apiError(c, 404, "api.attachmentNotFound");

  // 認証（accessMiddleware）通過後のみ到達する。エッジキャッシュは Worker 経由でしか読めない。
  // Range 付きは cache.match が全体 200 を返す可能性があるため R2 直で応答する
  const cache = caches.default;
  const cacheKey = attachmentCacheKey(c.req.url, projectId, key);
  if (!rangeHeader) {
    const cached = await cache.match(cacheKey);
    if (cached) {
      const response = new Response(cached.body, cached);
      response.headers.set("Cache-Control", IMMUTABLE_BROWSER_CACHE);
      return response;
    }
  }

  const mimeType = headObject.httpMetadata?.contentType ?? "application/octet-stream";
  const filename = decodeUploadFilename(headObject.customMetadata?.filename);
  const range = parseRangeHeader(rangeHeader, headObject.size);

  if (range) {
    const object = await bucket.get(objectKey, { range });
    if (!object?.body) apiError(c, 404, "api.attachmentNotFound");
    const headers = attachmentHeaders(object, mimeType, filename);
    headers.set("Cache-Control", IMMUTABLE_BROWSER_CACHE);
    headers.set("Content-Length", String(range.length));
    headers.set(
      "Content-Range",
      `bytes ${range.offset}-${range.offset + range.length - 1}/${headObject.size}`,
    );
    return new Response(object.body, { status: 206, headers });
  }

  const object = await bucket.get(objectKey);
  if (!object?.body) apiError(c, 404, "api.attachmentNotFound");

  const headers = attachmentHeaders(object, mimeType, filename);
  headers.set("Content-Length", String(object.size));

  const [clientBody, cacheBody] = object.body.tee();
  const cacheHeaders = new Headers(headers);
  cacheHeaders.set("Cache-Control", IMMUTABLE_EDGE_CACHE);
  c.executionCtx.waitUntil(
    cache
      .put(cacheKey, new Response(cacheBody, { status: 200, headers: cacheHeaders }))
      .catch(() => {}),
  );

  headers.set("Cache-Control", IMMUTABLE_BROWSER_CACHE);
  return new Response(clientBody, { status: 200, headers });
});

attachmentsRoutes.delete("/:projectId/attachments/:key", async (c) => {
  const bucket = requireBucket(c);
  const projectId = requireValidProjectId(c);
  const key = requireValidKey(c);

  await bucket.delete(attachmentObjectKey(projectId, key));
  c.executionCtx.waitUntil(
    caches.default.delete(attachmentCacheKey(c.req.url, projectId, key)).catch(() => {}),
  );
  return c.json({ ok: true });
});

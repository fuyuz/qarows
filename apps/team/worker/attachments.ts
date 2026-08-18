import type { AttachmentMimeType } from "@qarows/shared";

/** R2 オブジェクトキー。projectId prefix でプロジェクト削除時に一括削除する */
export function attachmentObjectKey(projectId: string, key: string): string {
  return `projects/${projectId}/attachments/${key}`;
}

export function attachmentPrefix(projectId: string): string {
  return `projects/${projectId}/attachments/`;
}

/** 時刻順に整列する UUIDv7（48bit unix ms + 74bit random） */
export function generateAttachmentKey(now = Date.now()): string {
  const bytes = new Uint8Array(16);
  crypto.getRandomValues(bytes);
  const ms = BigInt(now);
  bytes[0] = Number((ms >> 40n) & 0xffn);
  bytes[1] = Number((ms >> 32n) & 0xffn);
  bytes[2] = Number((ms >> 24n) & 0xffn);
  bytes[3] = Number((ms >> 16n) & 0xffn);
  bytes[4] = Number((ms >> 8n) & 0xffn);
  bytes[5] = Number(ms & 0xffn);
  bytes[6] = (bytes[6]! & 0x0f) | 0x70;
  bytes[8] = (bytes[8]! & 0x3f) | 0x80;
  const hex = Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}

function startsWithBytes(head: Uint8Array, offset: number, expected: number[]): boolean {
  if (head.byteLength < offset + expected.length) return false;
  return expected.every((byte, i) => head[offset + i] === byte);
}

function startsWithAscii(head: Uint8Array, offset: number, expected: string): boolean {
  return startsWithBytes(head, offset, Array.from(expected, (ch) => ch.charCodeAt(0)));
}

/**
 * 先頭バイトが申告 MIME タイプと矛盾しないか検証する（content sniffing 対策）。
 * クライアント申告を信用せず、保存する Content-Type は必ずこの検証を通ったものに限る。
 */
export function sniffMatchesMimeType(head: Uint8Array, mimeType: AttachmentMimeType): boolean {
  switch (mimeType) {
    case "image/png":
      return startsWithBytes(head, 0, [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
    case "image/jpeg":
      return startsWithBytes(head, 0, [0xff, 0xd8, 0xff]);
    case "image/gif":
      return startsWithAscii(head, 0, "GIF87a") || startsWithAscii(head, 0, "GIF89a");
    case "image/webp":
      return startsWithAscii(head, 0, "RIFF") && startsWithAscii(head, 8, "WEBP");
    case "video/mp4":
    case "video/quicktime":
      // ISO BMFF: 4 バイト目から "ftyp"（brand は多様なため個別判定しない）
      return startsWithAscii(head, 4, "ftyp");
    case "video/webm":
      // EBML ヘッダ（Matroska 系）
      return startsWithBytes(head, 0, [0x1a, 0x45, 0xdf, 0xa3]);
  }
}

/** MIME 判定に必要な先頭バイト数 */
export const SNIFF_HEAD_BYTES = 12;

/** RFC 5987 filename* 用エンコード。ヘッダインジェクションを構造的に防ぐ */
export function encodeContentDispositionFilename(name: string): string {
  const sanitized = name.replace(/[\r\n"\\]/g, "_").slice(0, 255) || "attachment";
  return `inline; filename*=UTF-8''${encodeURIComponent(sanitized)}`;
}

export interface ParsedRange {
  offset: number;
  length: number;
}

/**
 * 単一 Range のみ解釈する（multi-range は null を返し 200 全体配信にフォールバック）。
 * 戻り値は R2 の get({ range }) にそのまま渡せる形。
 */
export function parseRangeHeader(header: string | undefined, size: number): ParsedRange | null {
  if (!header) return null;
  const match = /^bytes=(\d*)-(\d*)$/.exec(header.trim());
  if (!match) return null;
  const [, startRaw, endRaw] = match;
  if (startRaw === "" && endRaw === "") return null;

  if (startRaw === "") {
    // suffix range: bytes=-N（末尾 N バイト）
    const suffix = Number(endRaw);
    if (!Number.isFinite(suffix) || suffix <= 0) return null;
    const length = Math.min(suffix, size);
    return { offset: size - length, length };
  }

  const start = Number(startRaw);
  if (!Number.isInteger(start) || start >= size) return null;
  const end = endRaw === "" ? size - 1 : Math.min(Number(endRaw), size - 1);
  if (!Number.isInteger(end) || end < start) return null;
  return { offset: start, length: end - start + 1 };
}

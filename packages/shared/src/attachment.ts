import type { BugAttachment } from "./types";

/** バグ 1 件あたりの添付上限 */
export const MAX_BUG_ATTACHMENTS = 5;

/** 添付 1 ファイルの上限（Workers のリクエストボディ 100MB に対して余裕を確保） */
export const MAX_ATTACHMENT_BYTES = 90 * 1024 * 1024;

/** 添付として許可する MIME タイプ（画像・動画のみ。SVG は XSS 経路になるため不可） */
export const ATTACHMENT_MIME_TYPES = [
  "image/png",
  "image/jpeg",
  "image/webp",
  "image/gif",
  "video/mp4",
  "video/webm",
  "video/quicktime",
] as const;

export type AttachmentMimeType = (typeof ATTACHMENT_MIME_TYPES)[number];

const ATTACHMENT_MIME_SET = new Set<string>(ATTACHMENT_MIME_TYPES);

export function isAllowedAttachmentMimeType(mimeType: string): mimeType is AttachmentMimeType {
  return ATTACHMENT_MIME_SET.has(mimeType);
}

export function isImageAttachment(mimeType: string): boolean {
  return mimeType.startsWith("image/");
}

/** 添付キーはサーバー生成 UUID のみ。パス操作や推測可能キーを構造的に排除する */
const ATTACHMENT_KEY_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;

export function isValidAttachmentKey(key: string): boolean {
  return ATTACHMENT_KEY_PATTERN.test(key);
}

const ATTACHMENT_EXTENSION_BY_MIME: Record<AttachmentMimeType, string> = {
  "image/png": "png",
  "image/jpeg": "jpg",
  "image/webp": "webp",
  "image/gif": "gif",
  "video/mp4": "mp4",
  "video/webm": "webm",
  "video/quicktime": "mov",
};

export function attachmentFileExtension(mimeType: string): string {
  return ATTACHMENT_EXTENSION_BY_MIME[mimeType as AttachmentMimeType] ?? "bin";
}

/** 表示用メタデータの上限（uploadedAt は ISO-8601、uploadedBy はメールアドレス想定） */
const MAX_ATTACHMENT_UPLOADED_AT_LENGTH = 64;
const MAX_ATTACHMENT_UPLOADED_BY_LENGTH = 320;

export type AttachmentValidationError = "unsupportedType" | "tooLarge" | "tooMany";

/** アップロード前のクライアント側バリデーション（無駄な送信を防ぐ） */
export function validateAttachmentFile(
  file: { type: string; size: number },
  currentCount: number,
): AttachmentValidationError | null {
  if (currentCount >= MAX_BUG_ATTACHMENTS) return "tooMany";
  if (!isAllowedAttachmentMimeType(file.type)) return "unsupportedType";
  if (file.size > MAX_ATTACHMENT_BYTES) return "tooLarge";
  return null;
}

/** results.json / コマンド経由の添付メタデータを正規化。不正エントリは捨て、上限で切る */
export function normalizeBugAttachments(raw: unknown): BugAttachment[] | undefined {
  if (!Array.isArray(raw)) return undefined;
  const attachments: BugAttachment[] = [];
  for (const entry of raw) {
    if (typeof entry !== "object" || entry === null) continue;
    const obj = entry as Record<string, unknown>;
    const key = String(obj.key ?? "").toLowerCase();
    if (!isValidAttachmentKey(key)) continue;
    const size = Number(obj.size);
    if (!Number.isFinite(size) || size < 0 || size > MAX_ATTACHMENT_BYTES) continue;
    const mimeType = String(obj.mimeType ?? "");
    if (!isAllowedAttachmentMimeType(mimeType)) continue;
    if (attachments.some((existing) => existing.key === key)) continue;
    attachments.push({
      key,
      name: String(obj.name ?? "").slice(0, 255) || `attachment.${attachmentFileExtension(mimeType)}`,
      size,
      mimeType,
      uploadedAt:
        obj.uploadedAt != null
          ? String(obj.uploadedAt).slice(0, MAX_ATTACHMENT_UPLOADED_AT_LENGTH)
          : undefined,
      uploadedBy:
        obj.uploadedBy != null
          ? String(obj.uploadedBy).slice(0, MAX_ATTACHMENT_UPLOADED_BY_LENGTH)
          : undefined,
    });
    if (attachments.length >= MAX_BUG_ATTACHMENTS) break;
  }
  return attachments.length > 0 ? attachments : undefined;
}

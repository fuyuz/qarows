import {
  strFromU8,
  strToU8,
  unzipSync,
  zipSync,
  type UnzipFileInfo,
  type Zippable,
} from "fflate";
import { MAX_ATTACHMENT_BYTES, MAX_BUG_ATTACHMENTS, attachmentFileExtension, isValidAttachmentKey } from "./attachment";

/** Per-member limit aligned with Team upload caps. */
export const MAX_ARCHIVE_MEMBER_BYTES = 5 * 1024 * 1024;
/** Total uncompressed payload limit (zip bomb guard). */
export const MAX_ARCHIVE_TOTAL_BYTES = 10 * 1024 * 1024;
/** Max yml/json entries extracted from one archive. */
export const MAX_ARCHIVE_ENTRIES = 32;

/** Max attachment entries extracted from one archive (Team import). */
export const MAX_ARCHIVE_ATTACHMENT_ENTRIES = 50 * MAX_BUG_ATTACHMENTS;
/** Total attachment payload limit per archive (Team import). */
export const MAX_ARCHIVE_ATTACHMENT_TOTAL_BYTES = 500 * 1024 * 1024;

export const PROJECT_ARCHIVE_TESTS_NAME = "tests.yml";
export const PROJECT_ARCHIVE_RESULTS_NAME = "results.json";
export const PROJECT_ARCHIVE_ATTACHMENTS_DIR = "attachments";

export interface PackProjectArchiveInput {
  testsYaml: string;
  resultsJson: string;
  /** Team 版: バグ添付の実体。attachments/<key>.<ext> として無圧縮で同梱する */
  attachments?: ProjectArchiveAttachment[];
}

export interface ProjectArchiveAttachment {
  key: string;
  mimeType: string;
  data: Uint8Array;
}

export interface UnpackedProjectFile {
  name: string;
  kind: "tests" | "results";
  content: string;
}

export class ProjectArchiveError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ProjectArchiveError";
  }
}

export function projectArchiveFilename(projectId: string): string {
  return `${projectId}.zip`;
}

export function projectArchiveToBlob(archive: Uint8Array<ArrayBuffer>): Blob {
  // Blob は渡した view の範囲をコピーするので、ここで slice() すると 1 回余分に複製される
  return new Blob([archive], { type: "application/zip" });
}

function archiveEntries(input: PackProjectArchiveInput): Zippable {
  const entries: Zippable = {
    [PROJECT_ARCHIVE_TESTS_NAME]: strToU8(input.testsYaml),
    [PROJECT_ARCHIVE_RESULTS_NAME]: strToU8(input.resultsJson),
  };
  for (const attachment of input.attachments ?? []) {
    if (!isValidAttachmentKey(attachment.key)) continue;
    const name = `${PROJECT_ARCHIVE_ATTACHMENTS_DIR}/${attachment.key}.${attachmentFileExtension(attachment.mimeType)}`;
    // 画像・動画は圧縮済みのため STORE で詰める
    entries[name] = [attachment.data, { level: 0 }];
  }
  return entries;
}

export function packProjectArchive(input: PackProjectArchiveInput): Uint8Array<ArrayBuffer> {
  return zipSync(archiveEntries(input));
}

function basename(entryPath: string): string {
  const normalized = entryPath.replace(/\\/g, "/");
  const parts = normalized.split("/");
  return parts[parts.length - 1] ?? entryPath;
}

function isSafeArchiveEntryPath(entryPath: string): boolean {
  if (entryPath.startsWith("/") || entryPath.includes("\\")) return false;
  const parts = entryPath.replace(/\\/g, "/").split("/");
  return parts.every((part) => part.length > 0 && part !== "..");
}

/** attachments/<key>.<ext> のファイル名から添付キーを取り出す */
function archiveAttachmentKey(entryName: string): string {
  return entryName.replace(/\.[A-Za-z0-9]+$/, "").toLowerCase();
}

function classifyArchiveEntryName(name: string): "tests" | "results" | null {
  const lower = name.toLowerCase();
  if (lower.endsWith(".yml") || lower.endsWith(".yaml")) return "tests";
  if (lower.endsWith(".json")) return "results";
  return null;
}

/**
 * 展開時に実際に確保されるバイト数の上界。
 * fflate は method 8（deflate）では出力を宣言サイズで打ち切るが（`out: new u8(su)`）、
 * method 0（無圧縮）は圧縮後サイズぶんをそのまま切り出すので、見る値が違う
 */
function declaredBytes(file: UnzipFileInfo): number {
  return file.compression === 0 ? file.size : file.originalSize;
}

/**
 * 展開前に central directory の宣言値で件数と合計を弾くフィルタ。
 * 展開後にしか合計を見ないと、高圧縮率のエントリ 1 本で先に OOM する
 */
function createBudgetFilter(options: {
  accept: (file: UnzipFileInfo) => boolean;
  maxEntries: number;
  maxTotalBytes: number;
  tooManyMessage: string;
  totalTooLargeMessage: string;
}): (file: UnzipFileInfo) => boolean {
  let entries = 0;
  let totalBytes = 0;
  return (file) => {
    if (!options.accept(file)) return false;
    entries += 1;
    if (entries > options.maxEntries) {
      throw new ProjectArchiveError(options.tooManyMessage);
    }
    totalBytes += declaredBytes(file);
    if (totalBytes > options.maxTotalBytes) {
      throw new ProjectArchiveError(options.totalTooLargeMessage);
    }
    return true;
  };
}

export function unpackProjectArchive(bytes: Uint8Array): UnpackedProjectFile[] {
  let entries: Record<string, Uint8Array>;
  try {
    // 添付エントリ（attachments/ 配下の画像・動画）は展開しない
    entries = unzipSync(bytes, {
      filter: createBudgetFilter({
        accept: (file) => {
          const name = basename(file.name);
          if (classifyArchiveEntryName(name) == null) return false;
          if (declaredBytes(file) > MAX_ARCHIVE_MEMBER_BYTES) {
            throw new ProjectArchiveError(
              `${name} が大きすぎます（上限 ${MAX_ARCHIVE_MEMBER_BYTES} バイト）`,
            );
          }
          return true;
        },
        maxEntries: MAX_ARCHIVE_ENTRIES,
        maxTotalBytes: MAX_ARCHIVE_TOTAL_BYTES,
        tooManyMessage: "zip 内の yml/json ファイルが多すぎます",
        totalTooLargeMessage: "zip の展開サイズが上限を超えています",
      }),
    });
  } catch (err) {
    if (err instanceof ProjectArchiveError) throw err;
    throw new ProjectArchiveError("zip ファイルの展開に失敗しました");
  }

  const extracted: UnpackedProjectFile[] = [];
  let totalBytes = 0;

  for (const [entryPath, payload] of Object.entries(entries)) {
    if (entryPath.endsWith("/")) continue;
    if (!isSafeArchiveEntryPath(entryPath)) {
      throw new ProjectArchiveError(`安全でない zip エントリです: ${entryPath}`);
    }

    const name = basename(entryPath);
    const kind = classifyArchiveEntryName(name);
    if (kind == null) continue;

    if (payload.byteLength > MAX_ARCHIVE_MEMBER_BYTES) {
      throw new ProjectArchiveError(`${name} が大きすぎます（上限 ${MAX_ARCHIVE_MEMBER_BYTES} バイト）`);
    }

    totalBytes += payload.byteLength;
    if (totalBytes > MAX_ARCHIVE_TOTAL_BYTES) {
      throw new ProjectArchiveError("zip の展開サイズが上限を超えています");
    }

    extracted.push({
      name,
      kind,
      content: strFromU8(payload),
    });
  }

  return extracted;
}

export interface UnpackedArchiveAttachment {
  /** attachments/<key>.<ext> の <key> 部分（UUID） */
  key: string;
  data: Uint8Array;
}

/** Team 版 import 用: attachments/ 配下のエントリのみ展開する */
export function unpackProjectArchiveAttachments(bytes: Uint8Array): UnpackedArchiveAttachment[] {
  const prefix = `${PROJECT_ARCHIVE_ATTACHMENTS_DIR}/`;
  let entries: Record<string, Uint8Array>;
  try {
    entries = unzipSync(bytes, {
      filter: createBudgetFilter({
        // 上限件数は「取り込む添付」で数える。attachments/ 配下の .DS_Store 等が
        // 枠を食って import 全体を落とさないよう、鍵の検証もここで済ませる
        accept: (file) =>
          file.name.startsWith(prefix) &&
          !file.name.endsWith("/") &&
          isValidAttachmentKey(archiveAttachmentKey(basename(file.name))) &&
          declaredBytes(file) <= MAX_ATTACHMENT_BYTES,
        maxEntries: MAX_ARCHIVE_ATTACHMENT_ENTRIES,
        maxTotalBytes: MAX_ARCHIVE_ATTACHMENT_TOTAL_BYTES,
        tooManyMessage: "zip 内の添付ファイルが多すぎます",
        totalTooLargeMessage: "zip 内の添付ファイル合計サイズが上限を超えています",
      }),
    });
  } catch (err) {
    if (err instanceof ProjectArchiveError) throw err;
    throw new ProjectArchiveError("zip ファイルの展開に失敗しました");
  }

  const attachments: UnpackedArchiveAttachment[] = [];
  let totalBytes = 0;

  for (const [entryPath, payload] of Object.entries(entries)) {
    if (!isSafeArchiveEntryPath(entryPath)) continue;
    const key = archiveAttachmentKey(basename(entryPath));
    if (!isValidAttachmentKey(key)) continue;
    // 展開前フィルタの宣言値チェックの裏取り（fflate の打ち切り挙動に依存しない）
    if (payload.byteLength > MAX_ATTACHMENT_BYTES) continue;

    totalBytes += payload.byteLength;
    if (totalBytes > MAX_ARCHIVE_ATTACHMENT_TOTAL_BYTES) {
      throw new ProjectArchiveError("zip 内の添付ファイル合計サイズが上限を超えています");
    }
    attachments.push({ key, data: payload });
  }

  return attachments;
}

export function unpackedProjectFilesToImportFiles(files: UnpackedProjectFile[]): File[] {
  return files.map((entry) => {
    const mime = entry.kind === "tests" ? "text/yaml" : "application/json";
    return new File([entry.content], entry.name, { type: mime });
  });
}

export async function expandImportFiles(files: File[]): Promise<File[]> {
  const expanded: File[] = [];

  for (const file of files) {
    if (file.name.toLowerCase().endsWith(".zip")) {
      const bytes = new Uint8Array(await file.arrayBuffer());
      const unpacked = unpackProjectArchive(bytes);
      expanded.push(...unpackedProjectFilesToImportFiles(unpacked));
      continue;
    }
    expanded.push(file);
  }

  return expanded;
}

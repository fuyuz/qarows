import { strFromU8, strToU8, unzipSync, zipSync } from "fflate";

/** Per-member limit aligned with Team upload caps. */
export const MAX_ARCHIVE_MEMBER_BYTES = 5 * 1024 * 1024;
/** Total uncompressed payload limit (zip bomb guard). */
export const MAX_ARCHIVE_TOTAL_BYTES = 10 * 1024 * 1024;
/** Max yml/json entries extracted from one archive. */
export const MAX_ARCHIVE_ENTRIES = 32;

export const PROJECT_ARCHIVE_TESTS_NAME = "tests.yml";
export const PROJECT_ARCHIVE_RESULTS_NAME = "results.json";

export interface PackProjectArchiveInput {
  testsYaml: string;
  resultsJson: string;
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

export function projectArchiveToBlob(archive: Uint8Array): Blob {
  return new Blob([archive.slice()], { type: "application/zip" });
}

export function packProjectArchive(input: PackProjectArchiveInput): Uint8Array {
  return zipSync({
    [PROJECT_ARCHIVE_TESTS_NAME]: strToU8(input.testsYaml),
    [PROJECT_ARCHIVE_RESULTS_NAME]: strToU8(input.resultsJson),
  });
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

function classifyArchiveEntryName(name: string): "tests" | "results" | null {
  const lower = name.toLowerCase();
  if (lower.endsWith(".yml") || lower.endsWith(".yaml")) return "tests";
  if (lower.endsWith(".json")) return "results";
  return null;
}

export function unpackProjectArchive(bytes: Uint8Array): UnpackedProjectFile[] {
  let entries: Record<string, Uint8Array>;
  try {
    entries = unzipSync(bytes);
  } catch {
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

    if (extracted.length > MAX_ARCHIVE_ENTRIES) {
      throw new ProjectArchiveError("zip 内の yml/json ファイルが多すぎます");
    }
  }

  return extracted;
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

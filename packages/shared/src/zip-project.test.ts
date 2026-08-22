import { describe, expect, it } from "vitest";
import { strToU8, unzipSync, zipSync, type UnzipFileInfo } from "fflate";
import {
  MAX_ARCHIVE_ATTACHMENT_ENTRIES,
  MAX_ARCHIVE_ENTRIES,
  MAX_ARCHIVE_MEMBER_BYTES,
  MAX_ARCHIVE_TOTAL_BYTES,
  packProjectArchive,
  ProjectArchiveError,
  projectArchiveFilename,
  unpackProjectArchive,
  unpackProjectArchiveAttachments,
} from "./zip-project";
import { MAX_ATTACHMENT_BYTES } from "./attachment";

function manyYmlEntries(count: number): Uint8Array {
  const entries: Record<string, Uint8Array> = {};
  for (let index = 0; index < count; index += 1) {
    entries[`part-${String(index).padStart(3, "0")}.yml`] = strToU8("x".repeat(400));
  }
  return zipSync(entries);
}

/** EOCD から central directory の先頭 offset を引く（deflate ストリーム内の誤検出を避ける） */
function centralDirectoryOffset(archive: Uint8Array): number {
  const view = new DataView(archive.buffer, archive.byteOffset, archive.byteLength);
  for (let i = archive.length - 22; i >= 0; i -= 1) {
    if (view.getUint32(i, true) === 0x06054b50) return view.getUint32(i + 16, true);
  }
  throw new Error("EOCD not found");
}

/** 最後のメンバの deflate ストリームだけ壊す。そこまで展開したら必ず失敗する zip になる */
function corruptLastStream(archive: Uint8Array): Uint8Array {
  const view = new DataView(archive.buffer, archive.byteOffset, archive.byteLength);
  let last = -1;
  for (let i = 0; i + 4 <= archive.length; i += 1) {
    if (view.getUint32(i, true) === 0x04034b50) last = i;
  }
  const start = last + 30 + view.getUint16(last + 26, true) + view.getUint16(last + 28, true);
  const out = archive.slice();
  out.fill(0xff, start, start + view.getUint32(last + 18, true));
  return out;
}

const sampleYaml = `
project:
  name: Zip QA
  id: zip-qa
environments:
  - id: chrome
    name: Chrome
testCases:
  - id: TC-001
    category:
      major: Auth
    description: Login
`;

const sampleResults = JSON.stringify(
  {
    projectId: "zip-qa",
    results: [],
    bugs: [],
  },
  null,
  2,
);

describe("project archive", () => {
  it("packs and unpacks official export names", () => {
    const archive = packProjectArchive({ testsYaml: sampleYaml, resultsJson: sampleResults });
    const files = unpackProjectArchive(archive);

    expect(files).toHaveLength(2);
    expect(files.find((file) => file.kind === "tests")?.name).toBe("tests.yml");
    expect(files.find((file) => file.kind === "results")?.name).toBe("results.json");
    expect(files.find((file) => file.kind === "tests")?.content).toContain("Zip QA");
    expect(files.find((file) => file.kind === "results")?.content).toContain('"projectId": "zip-qa"');
  });

  it("accepts alternate entry names by extension", () => {
    const archive = zipSync({
      "project/my-tests.yml": strToU8(sampleYaml),
      "runs/run-a.json": strToU8(sampleResults),
    });
    const files = unpackProjectArchive(archive);

    expect(files).toHaveLength(2);
    expect(files.find((file) => file.kind === "tests")?.name).toBe("my-tests.yml");
    expect(files.find((file) => file.kind === "results")?.name).toBe("run-a.json");
  });

  it("builds archive filename from project id", () => {
    expect(projectArchiveFilename("qarows")).toBe("qarows.zip");
  });

  it("rejects unsafe archive paths", () => {
    const archive = zipSync({
      "../tests.yml": strToU8(sampleYaml),
    });
    expect(() => unpackProjectArchive(archive)).toThrow(ProjectArchiveError);
  });

  it("rejects invalid zip data", () => {
    expect(() => unpackProjectArchive(new Uint8Array([0x50, 0x4b, 0x03, 0x04]))).toThrow(
      ProjectArchiveError,
    );
  });

  it("rejects a highly compressible member before decompressing it", () => {
    // 1 本で展開後上限を超えるが、圧縮後は数 KB にしかならない zip bomb
    const bomb = zipSync({ "tests.yml": strToU8("a".repeat(MAX_ARCHIVE_MEMBER_BYTES + 1)) });
    expect(bomb.byteLength).toBeLessThan(64 * 1024);
    expect(() => unpackProjectArchive(bomb)).toThrow(/大きすぎます/);
  });

  it("rejects a total that only exceeds the limit across members", () => {
    const perMember = "b".repeat(MAX_ARCHIVE_MEMBER_BYTES);
    const memberCount = Math.ceil(MAX_ARCHIVE_TOTAL_BYTES / MAX_ARCHIVE_MEMBER_BYTES) + 1;
    const entries: Record<string, Uint8Array> = {};
    for (let index = 0; index < memberCount; index += 1) {
      entries[`part-${index}.yml`] = strToU8(perMember);
    }
    expect(() => unpackProjectArchive(zipSync(entries))).toThrow(/展開サイズ/);
  });

  it("rejects more yml/json entries than the cap", () => {
    expect(() => unpackProjectArchive(manyYmlEntries(MAX_ARCHIVE_ENTRIES + 1))).toThrow(
      /多すぎます/,
    );
  });

  it("accepts exactly the entry cap", () => {
    expect(unpackProjectArchive(manyYmlEntries(MAX_ARCHIVE_ENTRIES))).toHaveLength(
      MAX_ARCHIVE_ENTRIES,
    );
  });

  /**
   * 上限判定が展開の前に効いているかは、返り値では区別できない。
   * 「最後のメンバのストリームだけ壊した zip」なら、展開まで進んだ場合は
   * 汎用の展開失敗メッセージになるので、専用メッセージが出れば展開前に弾いている
   */
  it("reports the member cap without decompressing the member", () => {
    const archive = corruptLastStream(
      zipSync({ "tests.yml": strToU8("a".repeat(MAX_ARCHIVE_MEMBER_BYTES + 1)) }),
    );
    expect(() => unpackProjectArchive(archive)).toThrow(/大きすぎます/);
  });

  it("reports the entry cap without decompressing the last entry", () => {
    const archive = corruptLastStream(manyYmlEntries(MAX_ARCHIVE_ENTRIES + 1));
    expect(() => unpackProjectArchive(archive)).toThrow(/多すぎます/);
  });

  it("rejects a stored member that exceeds the per-member limit", () => {
    const stored = zipSync(
      { "tests.yml": [strToU8("c".repeat(MAX_ARCHIVE_MEMBER_BYTES + 1)), { level: 0 }] },
      { level: 0 },
    );
    expect(() => unpackProjectArchive(stored)).toThrow(/大きすぎます/);
  });

  /**
   * 無圧縮（method 0）は宣言サイズで打ち切られず、圧縮後サイズぶんがそのまま出る。
   * だから展開前フィルタは method 0 では size を見る（declaredBytes）。
   * この挙動が変わると、宣言を小さく偽った無圧縮エントリの上界が取れなくなる
   */
  it("shows stored output following the compressed size, not the declared one", () => {
    const archive = zipSync({ "tests.yml": [strToU8("c".repeat(64 * 1024)), { level: 0 }] });
    const central = centralDirectoryOffset(archive);
    const view = new DataView(archive.buffer, archive.byteOffset, archive.byteLength);
    expect(view.getUint16(central + 10, true)).toBe(0);

    view.setUint32(central + 24, 10, true); // 宣言だけ 10 バイトに偽る

    const seen: UnzipFileInfo[] = [];
    const unpacked = unzipSync(archive, {
      filter: (file) => {
        seen.push(file);
        return true;
      },
    });
    expect(seen[0]).toMatchObject({ compression: 0, originalSize: 10, size: 64 * 1024 });
    // 宣言 10 でも 64KB 出る → originalSize だけでは上界にならない
    expect(unpacked["tests.yml"]).toHaveLength(64 * 1024);
  });

  /**
   * 展開前フィルタは central directory の宣言サイズを信じる。
   * deflate では fflate が宣言サイズで出力を打ち切ることが前提なので、それを固定する
   */
  it("relies on fflate bounding deflate output by the declared size", () => {
    const archive = zipSync({ "tests.yml": strToU8("a".repeat(64 * 1024)) });
    const central = centralDirectoryOffset(archive);
    const view = new DataView(archive.buffer, archive.byteOffset, archive.byteLength);
    expect(view.getUint16(central + 10, true)).toBe(8);
    expect(view.getUint32(central + 24, true)).toBe(64 * 1024);

    view.setUint32(central + 24, 10, true); // 宣言だけ 10 バイトに偽る

    const seen: Array<{ size: number; originalSize: number; compression: number }> = [];
    const unpacked = unzipSync(archive, {
      filter: (file) => {
        seen.push({
          size: file.size,
          originalSize: file.originalSize,
          compression: file.compression,
        });
        return true;
      },
    });
    expect(seen).toEqual([{ size: seen[0]!.size, originalSize: 10, compression: 8 }]);
    expect(unpacked["tests.yml"]).toHaveLength(10);
  });
});

describe("project archive attachments", () => {
  const key = "0189bd6c-1f2e-4a3b-8c4d-5e6f7a8b9c0d";

  function attachmentEntries(count: number): Record<string, Uint8Array> {
    const entries: Record<string, Uint8Array> = {};
    for (let index = 0; index < count; index += 1) {
      const suffix = String(index).padStart(4, "0");
      entries[`attachments/${key.slice(0, -4)}${suffix}.png`] = strToU8("x");
    }
    return entries;
  }

  it("accepts exactly the attachment cap and rejects one more", () => {
    expect(
      unpackProjectArchiveAttachments(zipSync(attachmentEntries(MAX_ARCHIVE_ATTACHMENT_ENTRIES))),
    ).toHaveLength(MAX_ARCHIVE_ATTACHMENT_ENTRIES);
    expect(() =>
      unpackProjectArchiveAttachments(
        zipSync(attachmentEntries(MAX_ARCHIVE_ATTACHMENT_ENTRIES + 1)),
      ),
    ).toThrow(/多すぎます/);
  });

  it("does not let junk under attachments/ consume the cap", () => {
    // macOS / Windows の再 zip が混ぜるファイルで import 全体を落とさない
    const entries = attachmentEntries(MAX_ARCHIVE_ATTACHMENT_ENTRIES);
    entries["attachments/.DS_Store"] = strToU8("junk");
    entries["attachments/notes.txt"] = strToU8("junk");

    const unpacked = unpackProjectArchiveAttachments(zipSync(entries));
    expect(unpacked).toHaveLength(MAX_ARCHIVE_ATTACHMENT_ENTRIES);
    expect(unpacked.every((entry) => entry.key !== ".ds_store")).toBe(true);
  });

  it("skips a stored attachment whose real size exceeds the per-file limit", () => {
    const oversized = new Uint8Array(MAX_ATTACHMENT_BYTES + 1);
    const archive = zipSync({ [`attachments/${key}.mp4`]: [oversized, { level: 0 }] });
    expect(unpackProjectArchiveAttachments(archive)).toEqual([]);
  });
});

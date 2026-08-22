import type { ProjectArchiveAttachment, ResultsFile } from "@qarows/shared";
import { attachmentUrl } from "@/lib/api/attachments";

/**
 * 同時取得数。HTTP/2 なので接続数の制約はないが、添付は 1 件ずつ Worker 呼び出し +
 * R2 取得になるので、無制限に投げても待ち行列が伸びるだけ
 */
const FETCH_CONCURRENCY = 6;

interface AttachmentRef {
  key: string;
  mimeType: string;
}

function collectRefs(results: ResultsFile): AttachmentRef[] {
  const refs: AttachmentRef[] = [];
  const seen = new Set<string>();
  for (const bug of results.bugs) {
    for (const meta of bug.attachments ?? []) {
      // 同じ添付が複数バグから参照されても取得は 1 回
      if (seen.has(meta.key)) continue;
      seen.add(meta.key);
      refs.push({ key: meta.key, mimeType: meta.mimeType });
    }
  }
  return refs;
}

/**
 * zip export 用にバグ添付の実体を取得する。
 * 削除済み（404）や取得失敗はスキップし、メタデータのみ results.json に残る。
 * 直列だと 50 バグ × 5 件で 250 往復を順番に待つことになるため、少数ずつ並行する
 */
export async function fetchProjectArchiveAttachments(
  projectId: string,
  results: ResultsFile | null,
): Promise<ProjectArchiveAttachment[]> {
  if (!results) return [];
  const refs = collectRefs(results);
  const attachments: Array<ProjectArchiveAttachment | null> = new Array(refs.length).fill(null);
  let next = 0;

  async function worker(): Promise<void> {
    for (;;) {
      const index = next++;
      const ref = refs[index];
      if (!ref) return;
      try {
        const response = await fetch(attachmentUrl(projectId, ref.key));
        if (!response.ok) continue;
        attachments[index] = {
          key: ref.key,
          mimeType: ref.mimeType,
          data: new Uint8Array(await response.arrayBuffer()),
        };
      } catch {
        // ネットワークエラーはスキップ（zip はメタデータのみで成立する）
      }
    }
  }

  await Promise.all(
    Array.from({ length: Math.min(FETCH_CONCURRENCY, refs.length) }, () => worker()),
  );
  // 元の並び順を保つ（zip のエントリ順が実行ごとに変わらないように）
  return attachments.filter((entry): entry is ProjectArchiveAttachment => entry !== null);
}

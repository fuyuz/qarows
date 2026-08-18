import type { ProjectArchiveAttachment, ResultsFile } from "@qarows/shared";
import { attachmentUrl } from "@/lib/api/attachments";

/**
 * zip export 用にバグ添付の実体を取得する。
 * 削除済み（404）や取得失敗はスキップし、メタデータのみ results.json に残る。
 */
export async function fetchProjectArchiveAttachments(
  projectId: string,
  results: ResultsFile | null,
): Promise<ProjectArchiveAttachment[]> {
  if (!results) return [];
  const attachments: ProjectArchiveAttachment[] = [];
  for (const bug of results.bugs) {
    for (const meta of bug.attachments ?? []) {
      try {
        const response = await fetch(attachmentUrl(projectId, meta.key));
        if (!response.ok) continue;
        attachments.push({
          key: meta.key,
          mimeType: meta.mimeType,
          data: new Uint8Array(await response.arrayBuffer()),
        });
      } catch {
        // ネットワークエラーはスキップ（zip はメタデータのみで成立する）
      }
    }
  }
  return attachments;
}

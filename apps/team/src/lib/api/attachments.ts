import type { BugAttachment } from "@qarows/shared";
import { apiJson } from "@/lib/api/client";

export function attachmentUrl(projectId: string, key: string): string {
  return `/api/projects/${encodeURIComponent(projectId)}/attachments/${encodeURIComponent(key)}`;
}

export async function uploadAttachment(
  projectId: string,
  file: File,
  options?: { key?: string },
): Promise<BugAttachment> {
  const headers: Record<string, string> = {
    "Content-Type": file.type,
    "X-Attachment-Filename": encodeURIComponent(file.name),
  };
  if (options?.key) headers["X-Attachment-Key"] = options.key;
  const { attachment } = await apiJson<{ attachment: BugAttachment }>(
    `/api/projects/${encodeURIComponent(projectId)}/attachments`,
    { method: "POST", headers, body: file },
  );
  return attachment;
}

export async function deleteAttachment(projectId: string, key: string): Promise<void> {
  await apiJson<{ ok: boolean }>(attachmentUrl(projectId, key), { method: "DELETE" });
}

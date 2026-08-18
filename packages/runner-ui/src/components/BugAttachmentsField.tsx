import {
  MAX_ATTACHMENT_BYTES,
  MAX_BUG_ATTACHMENTS,
  ATTACHMENT_MIME_TYPES,
  isImageAttachment,
  validateAttachmentFile,
  type BugAttachment,
} from "@qarows/shared";
import { Loader2, Paperclip, X } from "lucide-react";
import { useRef, useState, type Dispatch, type DragEvent, type SetStateAction } from "react";
import { Button, Label, cn, useTranslation } from "@qarows/ui";
import type { BugAttachmentsAdapter } from "../context/runner-workspace";
import type { BugDialogDraft } from "./BugDialog";

const MAX_MB = Math.floor(MAX_ATTACHMENT_BYTES / (1024 * 1024));
const ACCEPT = ATTACHMENT_MIME_TYPES.join(",");

export function BugAttachmentsField({
  idPrefix,
  adapter,
  draft,
  setDraft,
}: {
  idPrefix: string;
  adapter: BugAttachmentsAdapter;
  draft: BugDialogDraft;
  setDraft: Dispatch<SetStateAction<BugDialogDraft>>;
}) {
  const { t } = useTranslation();
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragActive, setDragActive] = useState(false);
  const [uploadingCount, setUploadingCount] = useState(0);
  const [errors, setErrors] = useState<string[]>([]);
  // setDraft の関数形式だけでは非同期アップロード間の件数競合を防げないため参照で数える
  const countRef = useRef(draft.attachments.length);
  countRef.current = draft.attachments.length;

  const addFiles = (files: File[]) => {
    const nextErrors: string[] = [];
    let pending = countRef.current + uploadingCount;
    const accepted: File[] = [];
    for (const file of files) {
      // アップロード前にサイズ・種類を検証して無駄な送信を避ける
      const error = validateAttachmentFile(file, pending);
      if (error === "tooMany") {
        nextErrors.push(t("bug.attachmentTooMany", { max: MAX_BUG_ATTACHMENTS }));
        break;
      }
      if (error === "unsupportedType") {
        nextErrors.push(t("bug.attachmentUnsupported", { name: file.name }));
        continue;
      }
      if (error === "tooLarge") {
        nextErrors.push(t("bug.attachmentTooLarge", { name: file.name, maxMb: MAX_MB }));
        continue;
      }
      accepted.push(file);
      pending += 1;
    }
    setErrors(nextErrors);
    if (accepted.length === 0) return;

    setUploadingCount((count) => count + accepted.length);
    for (const file of accepted) {
      void adapter
        .upload(file)
        .then((attachment: BugAttachment) => {
          setDraft((prev) => ({ ...prev, attachments: [...prev.attachments, attachment] }));
        })
        .catch(() => {
          setErrors((prev) => [...prev, t("bug.attachmentUploadFailed", { name: file.name })]);
        })
        .finally(() => {
          setUploadingCount((count) => count - 1);
        });
    }
  };

  const removeAttachment = (key: string) => {
    setDraft((prev) => ({
      ...prev,
      attachments: prev.attachments.filter((attachment) => attachment.key !== key),
    }));
  };

  const handleDrop = (event: DragEvent) => {
    event.preventDefault();
    setDragActive(false);
    const files = [...event.dataTransfer.files];
    if (files.length > 0) addFiles(files);
  };

  return (
    <div className="grid min-w-0 gap-2">
      <Label htmlFor={`${idPrefix}-attachments`}>{t("bug.attachments")}</Label>

      {draft.attachments.length > 0 && (
        <ul className="grid grid-cols-2 gap-2 sm:grid-cols-3">
          {draft.attachments.map((attachment) => (
            <li key={attachment.key} className="group relative overflow-hidden rounded-lg border">
              {isImageAttachment(attachment.mimeType) ? (
                <img
                  src={adapter.url(attachment.key)}
                  alt={attachment.name}
                  loading="lazy"
                  className="h-24 w-full object-cover"
                />
              ) : (
                <video
                  src={adapter.url(attachment.key)}
                  preload="metadata"
                  muted
                  playsInline
                  className="h-24 w-full bg-black object-cover"
                />
              )}
              <p className="truncate px-2 py-1 text-xs text-muted-foreground" title={attachment.name}>
                {attachment.name}
              </p>
              <Button
                type="button"
                variant="secondary"
                size="icon"
                className="absolute top-1 right-1 size-6 opacity-80 hover:opacity-100"
                aria-label={t("bug.attachmentRemove")}
                onClick={() => removeAttachment(attachment.key)}
              >
                <X className="size-3.5" aria-hidden />
              </Button>
            </li>
          ))}
        </ul>
      )}

      {(draft.attachments.length + uploadingCount < MAX_BUG_ATTACHMENTS || uploadingCount > 0) && (
        <div
          className={cn(
            "flex cursor-pointer items-center gap-2 rounded-lg border-2 border-dashed px-3 py-2.5 text-sm text-muted-foreground transition-colors",
            dragActive
              ? "border-primary bg-primary/5"
              : "border-border hover:border-primary/60 hover:bg-primary/5",
          )}
          role="button"
          tabIndex={0}
          onDragOver={(event) => {
            event.preventDefault();
            setDragActive(true);
          }}
          onDragLeave={() => setDragActive(false)}
          onDrop={handleDrop}
          onClick={() => inputRef.current?.click()}
          onKeyDown={(event) => {
            if (event.key === "Enter" || event.key === " ") {
              event.preventDefault();
              inputRef.current?.click();
            }
          }}
        >
          {uploadingCount > 0 ? (
            <>
              <Loader2 className="size-4 animate-spin" aria-hidden />
              <span>{t("bug.attachmentUploading")}</span>
            </>
          ) : (
            <>
              <Paperclip className="size-4" aria-hidden />
              <span>{t("bug.attachmentAddHint")}</span>
            </>
          )}
          <input
            ref={inputRef}
            id={`${idPrefix}-attachments`}
            type="file"
            accept={ACCEPT}
            multiple
            hidden
            onChange={() => {
              const files = inputRef.current?.files;
              if (files && files.length > 0) addFiles([...files]);
              if (inputRef.current) inputRef.current.value = "";
            }}
            onClick={(event) => event.stopPropagation()}
          />
        </div>
      )}

      <p className="text-xs text-muted-foreground">
        {t("bug.attachmentLimitHint", { max: MAX_BUG_ATTACHMENTS, maxMb: MAX_MB })}
      </p>
      {errors.map((message) => (
        <p key={message} className="text-sm text-destructive">
          {message}
        </p>
      ))}
    </div>
  );
}

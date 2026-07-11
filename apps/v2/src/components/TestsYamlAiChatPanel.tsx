import { useRef, useEffect } from "react";
import { Button, cn, Textarea } from "@qarows/ui";
import { ChevronDown, ChevronRight } from "lucide-react";
import type { AiChatMessage } from "@/lib/api/ai";

export function TestsYamlAiChatPanel({
  messages,
  input,
  busy,
  expanded,
  onExpand,
  onInputChange,
  onSend,
  onReset,
}: {
  messages: AiChatMessage[];
  input: string;
  busy: boolean;
  expanded: boolean;
  onExpand: () => void;
  onInputChange: (value: string) => void;
  onSend: () => void;
  onReset: () => void;
}) {
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!expanded) return;
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, busy, expanded]);

  const Chevron = expanded ? ChevronDown : ChevronRight;
  const summary =
    messages.length === 0
      ? "質問・編集指示"
      : `${messages.length} 件のメッセージ`;

  return (
    <div
      className={cn(
        "flex flex-col overflow-hidden rounded-lg border bg-card",
        expanded ? "min-h-0 flex-1" : "shrink-0",
      )}
    >
      <div className="flex items-center gap-1 border-b px-2 py-1.5">
        <button
          type="button"
          className="flex min-w-0 flex-1 items-center gap-1.5 rounded-md px-2 py-1.5 text-left hover:bg-muted/60"
          aria-expanded={expanded}
          onClick={onExpand}
        >
          <Chevron className="size-3.5 shrink-0 text-muted-foreground" aria-hidden />
          <span className="text-sm font-semibold">会話</span>
          {!expanded ? (
            <span className="truncate text-xs text-muted-foreground">{summary}</span>
          ) : null}
        </button>
        {expanded ? (
          <Button type="button" variant="ghost" size="sm" disabled={busy} onClick={onReset}>
            リセット
          </Button>
        ) : null}
      </div>

      {expanded ? (
        <>
          <div className="min-h-0 flex-1 space-y-3 overflow-y-auto px-4 py-4">
            {messages.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                テストケースについて質問したり、tests.yml の編集を指示できます。
              </p>
            ) : null}
            {messages.map((message, index) => (
              <div
                key={`${index}-${message.role}`}
                className={cn(
                  "max-w-[95%] rounded-lg px-3 py-2 text-sm whitespace-pre-wrap",
                  message.role === "user"
                    ? "ml-auto bg-primary text-primary-foreground"
                    : "mr-auto bg-muted text-foreground",
                )}
              >
                {message.content}
              </div>
            ))}
            {busy ? <p className="text-sm text-muted-foreground">考え中…</p> : null}
            <div ref={bottomRef} />
          </div>

          <div className="space-y-2 border-t px-4 py-3">
            <Textarea
              value={input}
              rows={3}
              disabled={busy}
              placeholder="テストケースについて質問、または編集を指示…"
              onChange={(event) => onInputChange(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Enter" && (event.metaKey || event.ctrlKey)) {
                  event.preventDefault();
                  onSend();
                }
              }}
            />
            <div className="flex justify-end">
              <Button type="button" disabled={busy || !input.trim()} onClick={onSend}>
                送信
              </Button>
            </div>
          </div>
        </>
      ) : null}
    </div>
  );
}

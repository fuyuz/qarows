import { useRef, useEffect } from "react";
import { Button, cn, Textarea } from "@qarows/ui";
import type { AiChatMessage } from "@/lib/api/ai";

export function TestsYamlAiChatPanel({
  messages,
  input,
  busy,
  onInputChange,
  onSend,
  onReset,
}: {
  messages: AiChatMessage[];
  input: string;
  busy: boolean;
  onInputChange: (value: string) => void;
  onSend: () => void;
  onReset: () => void;
}) {
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, busy]);

  return (
    <div className="flex min-h-0 flex-1 flex-col rounded-lg border bg-card">
      <div className="flex items-center justify-between border-b px-4 py-3">
        <h2 className="text-sm font-semibold">会話</h2>
        <Button type="button" variant="ghost" size="sm" disabled={busy} onClick={onReset}>
          会話をリセット
        </Button>
      </div>

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
    </div>
  );
}

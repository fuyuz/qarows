import * as Diff from "diff";
import { useMemo } from "react";
import { cn, useTranslation } from "@qarows/ui";

const CONTEXT_LINES = 3;

export function YamlTextDiffView({ before, after }: { before: string; after: string }) {
  const { t } = useTranslation();
  const lines = useMemo(() => {
    const parts = Diff.diffLines(before, after);
    const rendered: { kind: "add" | "remove" | "context"; text: string }[] = [];
    let contextBuffer: { kind: "add" | "remove" | "context"; text: string }[] = [];

    const flushContext = () => {
      if (contextBuffer.length === 0) return;
      if (contextBuffer.length <= CONTEXT_LINES * 2) {
        rendered.push(...contextBuffer);
      } else {
        rendered.push(...contextBuffer.slice(0, CONTEXT_LINES));
        rendered.push({ kind: "context", text: "…" });
        rendered.push(...contextBuffer.slice(-CONTEXT_LINES));
      }
      contextBuffer = [];
    };

    for (const part of parts) {
      const kind: "add" | "remove" | "context" = part.added
        ? "add"
        : part.removed
          ? "remove"
          : "context";
      const chunks = part.value.replace(/\n$/, "").split("\n");
      for (const text of chunks) {
        const row = { kind, text };
        if (kind === "context") {
          contextBuffer.push(row);
        } else {
          flushContext();
          rendered.push(row);
        }
      }
    }
    flushContext();
    return rendered;
  }, [before, after]);

  return (
    <div className="overflow-auto rounded-md border bg-muted/20">
      <pre className="p-3 font-mono text-xs leading-relaxed">
        {lines.map((line, index) => (
          <div
            key={`${index}-${line.text}`}
            className={cn(
              "whitespace-pre-wrap break-all",
              line.text === "…" && "text-center text-muted-foreground",
              line.kind === "add" && "bg-green-50 text-green-950",
              line.kind === "remove" && "bg-red-50 text-red-950 line-through",
              line.kind === "context" && "text-muted-foreground",
            )}
          >
            {line.text === "…" ? "…" : `${line.kind === "add" ? "+" : line.kind === "remove" ? "-" : " "} ${line.text}`}
          </div>
        ))}
      </pre>
      <p className="border-t px-3 py-2 text-xs text-muted-foreground">{t("definition.reorderHint")}</p>
    </div>
  );
}

import type { ReactNode } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/cn";

export interface RunnerCardNavProps {
  canPrev: boolean;
  canNext: boolean;
  busy?: boolean;
  onPrev: () => void;
  onNext: () => void;
}

interface RunnerCardFooterProps extends RunnerCardNavProps {
  children?: ReactNode;
  mode?: "test" | "intro" | "complete";
}

export function RunnerCardFooter({
  canPrev,
  canNext,
  busy = false,
  onPrev,
  onNext,
  children,
  mode = "test",
}: RunnerCardFooterProps) {
  if (mode === "intro") {
    return (
      <footer className="mt-auto shrink-0 border-t px-0 pb-5 pt-3.5">
        <div className="flex justify-center">
          <Button
            className="h-auto w-full max-w-80 py-2.5 font-semibold"
            disabled={!canNext || busy}
            onClick={onNext}
          >
            はじめる
          </Button>
        </div>
      </footer>
    );
  }

  if (mode === "complete") {
    return (
      <footer className="mt-auto shrink-0 border-t px-0 pb-5 pt-3.5">
        <Button
          variant="back"
          className="h-auto max-w-40 flex-1 py-2.5 font-semibold"
          disabled={!canPrev || busy}
          onClick={onPrev}
        >
          戻る
        </Button>
      </footer>
    );
  }

  return (
    <footer className="mt-auto flex shrink-0 items-stretch gap-2.5 border-t px-0 pb-5 pt-3.5">
      <Button
        variant="outline"
        size="icon"
        className="size-9 shrink-0 rounded-lg"
        disabled={!canPrev || busy}
        aria-label="前へ"
        onClick={onPrev}
      >
        <ChevronLeft className="size-5" />
      </Button>

      <div className="flex min-w-0 flex-1 gap-2.5">
        {children ?? (
          <>
            <div className="invisible flex-1 rounded-md bg-green-600/10 py-2.5" aria-hidden />
            <div className="invisible flex-1 rounded-md bg-red-600/10 py-2.5" aria-hidden />
          </>
        )}
      </div>

      <Button
        variant="outline"
        size="icon"
        className="size-9 shrink-0 rounded-lg"
        disabled={!canNext || busy}
        aria-label="次へ"
        onClick={onNext}
      >
        <ChevronRight className="size-5" />
      </Button>
    </footer>
  );
}

export function statusButtonClass(status: "OK" | "NG" | "SKIP", active: boolean): string {
  const base =
    "flex-1 text-xs font-medium shadow-none transition-[background-color,border-color,color] duration-300 ease-in-out motion-reduce:transition-none";
  if (!active) {
    return cn(base, "border bg-background hover:bg-muted");
  }
  if (status === "OK") return cn(base, "border-green-600 bg-green-50 text-green-800 hover:bg-green-100");
  if (status === "NG") return cn(base, "border-red-600 bg-red-50 text-red-800 hover:bg-red-100");
  return cn(base, "border-stone-500 bg-muted text-stone-800 hover:bg-muted/80");
}

export function testCardShellClass(extra?: string) {
  return cn(
    "flex min-h-[80vh] flex-col rounded-xl border bg-card px-5 pt-5 pb-0 shadow-sm",
    extra,
  );
}

import type { ReactNode } from "react";
import { cn } from "@/lib/cn";

export function RunnerCardTransition({
  direction,
  children,
}: {
  direction: number;
  children: ReactNode;
}) {
  return (
    <div
      className={cn(
        "animate-in fade-in fill-mode-both duration-250",
        direction >= 0 ? "slide-in-from-right-3" : "slide-in-from-left-3",
      )}
    >
      {children}
    </div>
  );
}

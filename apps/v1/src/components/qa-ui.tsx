import type { ReactNode } from "react";
import type { TestStatus } from "@qarows/shared";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/cn";

const STATUS_LABELS: Record<TestStatus, string> = {
  OK: "OK",
  NG: "NG",
  SKIP: "SKIP",
  OK_NG: "OK→NG",
};

const STATUS_VARIANTS: Record<TestStatus, string> = {
  OK: "border-transparent bg-green-100 text-green-800",
  NG: "border-transparent bg-red-100 text-red-800",
  SKIP: "border-transparent bg-muted text-muted-foreground",
  OK_NG: "border-transparent bg-orange-100 text-orange-800",
};

export function StatusBadge({
  status,
  className,
}: {
  status: TestStatus;
  className?: string;
}) {
  return (
    <Badge
      variant="outline"
      className={cn(
        "text-[0.7rem] font-bold transition-all duration-200 animate-in fade-in zoom-in-95 fill-mode-both",
        STATUS_VARIANTS[status],
        className,
      )}
    >
      {STATUS_LABELS[status]}
    </Badge>
  );
}

export function Kbd({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <kbd
      className={cn(
        "inline-flex min-w-[1.1em] items-center justify-center rounded border border-border bg-muted px-1.5 py-0.5 font-sans text-[0.85em] font-semibold leading-snug text-foreground",
        className,
      )}
    >
      {children}
    </kbd>
  );
}

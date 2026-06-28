import type { TestCase } from "@qarows/shared";
import type { ReactNode } from "react";
import { cn } from "@qarows/ui";

function formatCategory(testCase: TestCase): string {
  const parts = [testCase.category.major];
  if (testCase.category.medium) parts.push(testCase.category.medium);
  if (testCase.category.minor) parts.push(testCase.category.minor);
  return parts.join(" › ");
}

export function TestCaseHoverPreview({
  testCase,
  children,
  className,
}: {
  testCase: TestCase;
  children: ReactNode;
  className?: string;
}) {
  return (
    <span className={cn("group/tc relative inline-flex", className)}>
      {children}
      <span
        role="tooltip"
        className="pointer-events-none absolute left-0 top-[calc(100%+0.35rem)] z-50 hidden w-72 rounded-lg border bg-popover p-3 text-popover-foreground shadow-md group-hover/tc:block"
      >
        <span className="mb-1 block text-[0.72rem] font-bold text-primary">{testCase.id}</span>
        <span className="mb-2 block text-[0.68rem] text-muted-foreground">
          {formatCategory(testCase)}
        </span>
        {testCase.prerequisites && (
          <span className="mb-2 block text-xs leading-relaxed text-muted-foreground">
            <span className="font-semibold text-foreground/80">前提: </span>
            {testCase.prerequisites}
          </span>
        )}
        <span className="block text-xs leading-relaxed text-foreground/90">{testCase.description}</span>
      </span>
    </span>
  );
}

import { cn } from "../../lib/cn";

/** Paper Bold q monogram (matches public/favicon.svg). */
export function BrandMark({
  className,
  title = "qarows",
}: {
  className?: string;
  title?: string;
}) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 32 32"
      className={cn("size-8 shrink-0 rounded-[22%] ring-1 ring-border", className)}
      role="img"
      aria-label={title}
    >
      <rect width="32" height="32" rx="7" fill="#FFFFFF" />
      <circle
        cx="14.8"
        cy="14.2"
        r="5.7"
        fill="none"
        stroke="#0A0A0A"
        strokeWidth="3.4"
      />
      <path
        d="M20.5 15.6V25"
        fill="none"
        stroke="#0A0A0A"
        strokeWidth="3.4"
        strokeLinecap="round"
      />
    </svg>
  );
}

export function BrandLockup({
  subtitle,
  className,
  markClassName,
  align = "start",
}: {
  subtitle?: string;
  className?: string;
  markClassName?: string;
  align?: "start" | "center";
}) {
  return (
    <div
      className={cn(
        "flex items-center gap-2.5",
        align === "center" && "justify-center",
        className,
      )}
    >
      <BrandMark className={markClassName} />
      <div>
        <p className="text-lg font-bold tracking-tight">qarows</p>
        {subtitle ? (
          <p className="text-xs text-muted-foreground">{subtitle}</p>
        ) : null}
      </div>
    </div>
  );
}

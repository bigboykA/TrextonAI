import { cn } from "@/lib/utils";

type BrandMarkProps = {
  className?: string;
  title?: string;
};

export function BrandMark({
  className,
  title,
}: BrandMarkProps) {
  return (
    <svg
      viewBox="0 0 32 32"
      role={title ? "img" : undefined}
      aria-hidden={title ? undefined : true}
      className={cn("size-8", className)}
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
    >
      {title ? <title>{title}</title> : null}
      <path
        d="M13.5 2.9a3.65 3.65 0 0 1 5 0l10.6 10.6a3.65 3.65 0 0 1 0 5L18.5 29.1a3.65 3.65 0 0 1-5 0L2.9 18.5a3.65 3.65 0 0 1 0-5L13.5 2.9Z"
        fill="currentColor"
      />
      <path
        d="M9.7 10.7h10.7M15.05 10.7v10.7"
        stroke="var(--brand-mark-ink)"
        strokeWidth="2.25"
        strokeLinecap="round"
      />
      <path
        d="m18.9 18.1 3.7 3.7m0-3.7-3.7 3.7"
        stroke="var(--brand-mark-ink)"
        strokeWidth="1.6"
        strokeLinecap="round"
        opacity="0.72"
      />
    </svg>
  );
}

export function BrandWordmark({
  compact = false,
  className,
}: {
  compact?: boolean;
  className?: string;
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-2.5",
        className
      )}
    >
      <BrandMark className="size-8 text-primary" />
      {!compact ? (
        <span className="inline-flex items-baseline">
          <span className="text-[1.05rem] font-semibold tracking-[-0.045em]">
            Trexton
          </span>
          <span className="ml-1 text-[0.58rem] font-semibold uppercase tracking-[0.12em] text-primary">
            AI
          </span>
        </span>
      ) : null}
    </span>
  );
}

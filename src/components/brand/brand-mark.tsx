import { cn } from "@/lib/utils";

type BrandMarkProps = {
  className?: string;
  title?: string;
  style?: React.CSSProperties;
};

type LogoConceptProps = BrandMarkProps & {
  concept: "faceted" | "angular" | "minimal";
};

export function LogoConcept({
  className,
  title,
  concept,
  style,
}: LogoConceptProps) {
  return (
    <svg
      viewBox="0 0 32 32"
      role={title ? "img" : undefined}
      aria-hidden={title ? undefined : true}
      className={cn("size-8", className)}
      style={style}
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
    >
      {title ? <title>{title}</title> : null}
      {concept === "faceted" ? (
        <>
          <path
            d="M3.25 6.4 7.45 2h17.1l4.2 4.4L24.55 9H19v15.85L16 30l-3-5.15V9H7.45L3.25 6.4Z"
            fill="currentColor"
          />
          <path
            d="m14.6 19.4 2.8 2.8m0-2.8-2.8 2.8"
            stroke="var(--brand-mark-ink)"
            strokeWidth="1.1"
            strokeLinecap="square"
          />
          <path
            d="m7.45 2 4.2 7M24.55 2l-4.2 7M13 24.85 16 23l3 1.85"
            stroke="var(--brand-mark-ink)"
            strokeWidth=".7"
            opacity=".28"
          />
        </>
      ) : null}
      {concept === "angular" ? (
        <>
          <path
            d="M16 1.25 29.5 8.5l-2.2 14.25L16 30.75 4.7 22.75 2.5 8.5 16 1.25Z"
            fill="currentColor"
          />
          <path
            d="M8.1 8.25h15.8l-2.35 4.1H18.2v10.4L16 25.4l-2.2-2.65v-10.4h-3.35L8.1 8.25Z"
            fill="var(--brand-mark-ink)"
          />
          <path
            d="m19.35 17.9 3.15 3.15m0-3.15-3.15 3.15"
            stroke="var(--brand-mark-ink)"
            strokeWidth="1.2"
            strokeLinecap="square"
          />
          <path
            d="M2.5 8.5h5.6M29.5 8.5h-5.6M4.7 22.75l9.1-10.4m13.5 10.4-9.1-10.4"
            stroke="var(--brand-mark-ink)"
            strokeWidth=".65"
            opacity=".32"
          />
        </>
      ) : null}
      {concept === "minimal" ? (
        <>
          <path
            d="M4 5.5 7.5 2h20.5l-4 6.5h-5.35v16.75L16 29l-2.65-3.75V8.5H8L4 5.5Z"
            fill="currentColor"
          />
          <path
            d="m14.4 20 3.2 3.2m0-3.2-3.2 3.2"
            stroke="var(--brand-mark-ink)"
            strokeWidth="1.3"
            strokeLinecap="square"
          />
        </>
      ) : null}
    </svg>
  );
}

export function BrandMark({
  className,
  title,
  style,
}: BrandMarkProps) {
  return (
    <LogoConcept
      concept="faceted"
      className={className}
      title={title}
      style={style}
    />
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

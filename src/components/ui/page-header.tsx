type PageHeaderProps = {
  eyebrow: string;
  title: string;
  description: string;
  action?: React.ReactNode;
};

export function PageHeader({
  eyebrow,
  title,
  description,
  action,
}: PageHeaderProps) {
  return (
    <header className="flex flex-col gap-5 border-b border-border/65 pb-8 sm:flex-row sm:items-end sm:justify-between">
      <div>
        <p className="mb-3 inline-flex items-center gap-2 text-[0.68rem] font-semibold uppercase tracking-[0.2em] text-primary">
          <span
            aria-hidden="true"
            className="size-1.5 rotate-45 rounded-[2px] bg-primary"
          />
          {eyebrow}
        </p>
        <h1 className="max-w-3xl text-3xl font-semibold leading-[1.06] tracking-[-0.045em] text-balance sm:text-[2.65rem]">
          {title}
        </h1>
        <p className="mt-3 max-w-2xl text-sm leading-6 text-muted-foreground sm:text-base">
          {description}
        </p>
      </div>
      {action ? <div className="shrink-0">{action}</div> : null}
    </header>
  );
}

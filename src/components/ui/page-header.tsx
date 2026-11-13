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
    <header className="flex flex-col gap-4 border-b border-border/70 pb-5 sm:flex-row sm:items-end sm:justify-between">
      <div>
        <p className="mb-1.5 text-xs font-medium text-primary">
          {eyebrow}
        </p>
        <h1 className="max-w-3xl text-2xl font-semibold leading-tight tracking-[-0.035em] text-balance">
          {title}
        </h1>
        <p className="mt-1.5 max-w-2xl text-sm leading-5 text-muted-foreground">
          {description}
        </p>
      </div>
      {action ? <div className="shrink-0">{action}</div> : null}
    </header>
  );
}

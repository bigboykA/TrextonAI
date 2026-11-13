import Link from "next/link";
import type { LucideIcon } from "lucide-react";
import { ArrowUpRight } from "lucide-react";
import { cn } from "@/lib/utils";

type EmptyStateProps = {
  icon: LucideIcon;
  title: string;
  description: string;
  action?: {
    label: string;
    href: string;
  };
  className?: string;
};

export function EmptyState({
  icon: Icon,
  title,
  description,
  action,
  className,
}: EmptyStateProps) {
  return (
    <div
      className={cn(
        "flex min-h-72 flex-col items-center justify-center rounded-3xl border border-dashed border-border bg-card/45 px-6 py-14 text-center",
        className
      )}
    >
      <div className="mb-5 grid size-11 place-items-center rounded-2xl border border-border bg-background text-muted-foreground shadow-sm">
        <Icon aria-hidden="true" className="size-5" />
      </div>
      <h3 className="text-lg font-semibold tracking-tight">
        {title}
      </h3>
      <p className="mt-2 max-w-md text-sm leading-6 text-muted-foreground">
        {description}
      </p>
      {action ? (
        <Link
          href={action.href}
          className="mt-6 inline-flex h-10 items-center gap-2 rounded-full bg-primary px-4 text-sm font-medium text-primary-foreground transition-transform hover:-translate-y-0.5 focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-ring/30 motion-reduce:transform-none"
        >
          {action.label}
          <ArrowUpRight aria-hidden="true" className="size-4" />
        </Link>
      ) : null}
    </div>
  );
}

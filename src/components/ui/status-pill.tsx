import {
  CircleCheck,
  CircleDashed,
  CircleX,
  LoaderCircle,
} from "lucide-react";
import type { ProcessingStatus } from "@/lib/frontend-types";
import { cn } from "@/lib/utils";

const statusDetails = {
  pending: {
    label: "Waiting",
    icon: CircleDashed,
    className: "bg-muted text-muted-foreground",
  },
  processing: {
    label: "Processing",
    icon: LoaderCircle,
    className:
      "bg-primary/10 text-primary [&_svg]:animate-spin motion-reduce:[&_svg]:animate-none",
  },
  completed: {
    label: "Ready",
    icon: CircleCheck,
    className: "bg-success/12 text-success",
  },
  failed: {
    label: "Needs attention",
    icon: CircleX,
    className: "bg-destructive/10 text-destructive",
  },
} satisfies Record<
  ProcessingStatus,
  {
    label: string;
    icon: typeof CircleCheck;
    className: string;
  }
>;

export function StatusPill({
  status,
}: {
  status: ProcessingStatus;
}) {
  const details = statusDetails[status];
  const Icon = details.icon;

  return (
    <span
      className={cn(
        "inline-flex h-7 items-center gap-1.5 rounded-full px-2.5 text-xs font-medium",
        details.className
      )}
    >
      <Icon aria-hidden="true" className="size-3.5" />
      {details.label}
    </span>
  );
}

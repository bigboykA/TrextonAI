import {
  CircleCheck,
  CircleDashed,
  CircleX,
  LoaderCircle,
} from "lucide-react";
import type { SubmissionStatus } from "@/lib/frontend-types";
import { cn } from "@/lib/utils";

export function RecordingStatus({
  status,
}: {
  status: SubmissionStatus | "unprocessed";
}) {
  const details =
    status === "completed"
      ? {
          label: "Ready",
          icon: CircleCheck,
          className: "text-success",
        }
      : status === "failed"
        ? {
            label: "Failed",
            icon: CircleX,
            className: "text-destructive",
          }
        : status === "processing"
          ? {
              label: "Processing",
              icon: LoaderCircle,
              className: "text-primary",
            }
          : status === "queued"
            ? {
                label: "Queued",
                icon: CircleDashed,
                className: "text-primary",
              }
            : status === "awaiting_publication" || status === "pending"
              ? {
                  label: "Waiting",
                  icon: CircleDashed,
                  className: "text-muted-foreground",
                }
              : {
                  label: "Not processed",
                  icon: CircleDashed,
                  className: "text-muted-foreground",
                };
  const Icon = details.icon;

  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 text-[11px] font-medium",
        details.className
      )}
    >
      <Icon
        aria-hidden="true"
        className={cn(
          "size-3.5",
          status === "processing" &&
            "animate-spin motion-reduce:animate-none"
        )}
      />
      {details.label}
    </span>
  );
}

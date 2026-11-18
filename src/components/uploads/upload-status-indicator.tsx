"use client";

import Link from "next/link";
import {
  AlertCircle,
  CheckCircle2,
  CloudUpload,
  LoaderCircle,
} from "lucide-react";
import { useUploadManager } from "@/components/providers/upload-provider";
import { cn } from "@/lib/utils";

const labelByPhase = {
  awaiting_file: "Resume upload",
  preparing: "Preparing upload",
  uploading: "Uploading",
  finalizing: "Finalizing",
  waiting_processing: "Waiting to process",
  queued: "Queued",
  processing: "Processing",
  completed: "Highlights ready",
  failed: "Needs attention",
  cancelling: "Cancelling",
} as const;

export function UploadStatusIndicator() {
  const upload = useUploadManager();
  const hasManagedActivity = !["idle", "ready"].includes(upload.phase);
  const phase = hasManagedActivity
    ? upload.phase
    : upload.backgroundJobPhase;

  if (
    !phase ||
    phase === "idle" ||
    phase === "ready" ||
    (phase === "completed" && !hasManagedActivity)
  ) {
    return null;
  }

  const icon =
    phase === "failed" ? (
      <AlertCircle aria-hidden="true" className="size-3.5" />
    ) : phase === "completed" ? (
      <CheckCircle2 aria-hidden="true" className="size-3.5" />
    ) : ["uploading", "finalizing"].includes(phase) ? (
      <CloudUpload aria-hidden="true" className="size-3.5" />
    ) : (
      <LoaderCircle
        aria-hidden="true"
        className="size-3.5 animate-spin motion-reduce:animate-none"
      />
    );
  const className = cn(
    "inline-flex h-9 max-w-48 items-center gap-2 rounded-full border bg-card px-3 text-xs font-medium shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-ring/30",
    phase === "failed"
      ? "border-destructive/25 text-destructive hover:bg-destructive/5"
      : "border-border text-foreground hover:border-primary/30 hover:text-primary"
  );
  const content = (
    <>
      {icon}
      <span className="truncate">
        {labelByPhase[phase as keyof typeof labelByPhase]}
      </span>
      {phase === "uploading" ? (
        <span className="tabular-nums text-muted-foreground">
          {upload.progress}%
        </span>
      ) : null}
    </>
  );

  if (hasManagedActivity) {
    return (
      <button
        type="button"
        className={className}
        onClick={upload.openDialog}
        aria-label={`${labelByPhase[phase as keyof typeof labelByPhase]}. Open upload details`}
      >
        {content}
      </button>
    );
  }

  return (
    <Link href="/activity" className={className}>
      {content}
    </Link>
  );
}

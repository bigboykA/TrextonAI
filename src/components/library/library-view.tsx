"use client";

import { useEffect } from "react";
import {
  CircleCheck,
  CircleDashed,
  CircleX,
  Film,
  LoaderCircle,
  Plus,
  TriangleAlert,
} from "lucide-react";
import { ClipsPanel } from "@/components/clips/clips-panel";
import { useUploadManager } from "@/components/providers/upload-provider";
import { useWorkspace } from "@/components/providers/workspace-provider";
import { EmptyState } from "@/components/ui/empty-state";
import { useRecordings } from "@/hooks/use-recordings";
import { formatFileSize, formatRelativeDate } from "@/lib/format";
import type { SubmissionStatus } from "@/lib/frontend-types";
import { cn } from "@/lib/utils";

function RecordingStatus({
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

export function LibraryView() {
  const { recordings, isLoading, error, refresh } = useRecordings();
  const {
    activeVideoId,
    setActiveVideoId,
    setActiveJobId,
  } = useWorkspace();
  const { openDialog } = useUploadManager();

  useEffect(() => {
    if (
      recordings.length > 0 &&
      !recordings.some((recording) => recording.id === activeVideoId)
    ) {
      setActiveVideoId(recordings[0].id);
      setActiveJobId(recordings[0].latestJob?.id ?? "");
    }
  }, [
    activeVideoId,
    recordings,
    setActiveJobId,
    setActiveVideoId,
  ]);

  const selectedRecording =
    recordings.find((recording) => recording.id === activeVideoId) ??
    recordings[0];
  const selectedStatus =
    selectedRecording?.latestJob?.submissionStatus ??
    selectedRecording?.latestJob?.status;

  return (
    <div className="space-y-6">
      <header className="flex flex-col gap-4 border-b border-border pb-5 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-[-0.035em]">
            Library
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Browse recordings and review their generated highlights.
          </p>
        </div>
        <button
          type="button"
          onClick={openDialog}
          className="inline-flex h-11 items-center gap-2 self-start rounded-lg bg-primary px-3.5 text-xs font-semibold text-primary-foreground shadow-sm transition-transform duration-[var(--motion-feedback)] hover:scale-[1.02] active:scale-[0.98] focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-ring/30 motion-reduce:transform-none sm:h-9 sm:self-auto"
        >
          <Plus aria-hidden="true" className="size-3.5" />
          New recording
        </button>
      </header>

      {isLoading ? (
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {Array.from({ length: 3 }).map((_, index) => (
            <div
              key={index}
              className="h-32 animate-pulse rounded-2xl border border-border bg-muted/55 motion-reduce:animate-none"
            />
          ))}
        </div>
      ) : error ? (
        <EmptyState
          icon={TriangleAlert}
          title="Recordings could not be loaded"
          description={error}
        />
      ) : recordings.length === 0 ? (
        <div className="flex min-h-72 flex-col items-center justify-center rounded-3xl border border-dashed border-border bg-card/45 px-6 py-14 text-center">
          <div className="grid size-11 place-items-center rounded-2xl border border-border bg-background text-muted-foreground shadow-sm">
            <Film aria-hidden="true" className="size-5" />
          </div>
          <h2 className="mt-5 text-lg font-semibold tracking-tight">
            Your library is ready
          </h2>
          <p className="mt-2 max-w-md text-sm leading-6 text-muted-foreground">
            Upload a recording and Trexton will add it here while its
            highlights are generated.
          </p>
          <button
            type="button"
            onClick={openDialog}
            className="mt-6 inline-flex h-11 items-center gap-2 rounded-full bg-primary px-4 text-sm font-medium text-primary-foreground focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-ring/30"
          >
            <Plus aria-hidden="true" className="size-4" />
            Upload recording
          </button>
        </div>
      ) : (
        <>
          <section aria-labelledby="recordings-heading">
            <div className="mb-3 flex items-center justify-between gap-4">
              <div>
                <h2
                  id="recordings-heading"
                  className="text-sm font-semibold"
                >
                  Recordings
                </h2>
                <p className="mt-0.5 text-xs text-muted-foreground">
                  Select a source to view its highlights
                </p>
              </div>
              <button
                type="button"
                onClick={() => void refresh()}
                className="h-11 rounded-lg px-3 text-xs font-medium text-muted-foreground hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-ring/30 sm:h-8"
              >
                Refresh
              </button>
            </div>
            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
              {recordings.map((recording) => {
                const isSelected =
                  recording.id === selectedRecording?.id;
                const status =
                  recording.latestJob?.submissionStatus ??
                  recording.latestJob?.status ??
                  "unprocessed";

                return (
                  <button
                    key={recording.id}
                    type="button"
                    aria-pressed={isSelected}
                    onClick={() => {
                      setActiveVideoId(recording.id);
                      setActiveJobId(recording.latestJob?.id ?? "");
                    }}
                    className={cn(
                      "rounded-2xl border bg-card p-4 text-left transition-colors focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-ring/30",
                      isSelected
                        ? "border-primary/45 bg-primary/[0.035]"
                        : "border-border hover:border-primary/25"
                    )}
                  >
                    <div className="flex items-start gap-3">
                      <div className="grid size-9 shrink-0 place-items-center rounded-xl bg-primary/10 text-primary">
                        <Film aria-hidden="true" className="size-4" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-semibold">
                          {recording.title || "Untitled recording"}
                        </p>
                        <p className="mt-1 text-xs text-muted-foreground">
                          {formatRelativeDate(recording.createdAt)}
                          {recording.sourceSizeBytes
                            ? ` · ${formatFileSize(recording.sourceSizeBytes)}`
                            : ""}
                        </p>
                      </div>
                    </div>
                    <div className="mt-4 flex items-center justify-between border-t border-border pt-3">
                      <RecordingStatus status={status} />
                      <span className="text-[11px] text-muted-foreground">
                        {recording.clipCount}{" "}
                        {recording.clipCount === 1 ? "highlight" : "highlights"}
                      </span>
                    </div>
                  </button>
                );
              })}
            </div>
          </section>

          <section className="border-t border-border pt-6">
            <ClipsPanel processingStatus={selectedStatus} />
          </section>
        </>
      )}
    </div>
  );
}

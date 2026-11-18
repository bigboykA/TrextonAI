"use client";

import { useMemo, useState } from "react";
import {
  CheckCircle2,
  CircleDashed,
  Clapperboard,
  CloudUpload,
  LoaderCircle,
  Plus,
  RotateCcw,
  TriangleAlert,
  XCircle,
} from "lucide-react";
import { useUploadManager } from "@/components/providers/upload-provider";
import { useWorkspace } from "@/components/providers/workspace-provider";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { useActivity } from "@/hooks/use-activity";
import {
  notifyTrextonDataChanged,
  useRecordings,
} from "@/hooks/use-recordings";
import { formatFileSize, formatRelativeDate } from "@/lib/format";
import type {
  JobActivity,
  UploadActivity,
} from "@/lib/frontend-types";
import { cn } from "@/lib/utils";

type TimelineItem =
  | { kind: "upload"; date: string; item: UploadActivity }
  | { kind: "job"; date: string; item: JobActivity };

function displayJobStatus(job: JobActivity) {
  return job.submissionStatus ?? job.status;
}

function statusDetails(
  kind: "upload" | "job",
  status: string
) {
  if (status === "completed") {
    return {
      label: kind === "upload" ? "Upload complete" : "Completed",
      icon: CheckCircle2,
      className: "bg-success/12 text-success",
    };
  }
  if (status === "failed" || status === "aborted") {
    return {
      label: status === "aborted" ? "Cancelled" : "Failed",
      icon: status === "aborted" ? XCircle : TriangleAlert,
      className: "bg-destructive/10 text-destructive",
    };
  }
  if (status === "processing") {
    return {
      label: "Processing",
      icon: LoaderCircle,
      className: "bg-primary/10 text-primary",
    };
  }
  if (status === "queued") {
    return {
      label: "Queued",
      icon: CircleDashed,
      className: "bg-primary/10 text-primary",
    };
  }
  if (status === "awaiting_publication" || status === "pending") {
    return {
      label: "Waiting for processing",
      icon: CircleDashed,
      className: "bg-muted text-muted-foreground",
    };
  }
  if (status === "completing") {
    return {
      label: "Finalizing upload",
      icon: LoaderCircle,
      className: "bg-primary/10 text-primary",
    };
  }
  return {
    label: "Uploading",
    icon: CloudUpload,
    className: "bg-primary/10 text-primary",
  };
}

function ActivityStatus({
  kind,
  status,
}: {
  kind: "upload" | "job";
  status: string;
}) {
  const details = statusDetails(kind, status);
  const Icon = details.icon;
  const isSpinning =
    status === "processing" || status === "completing";

  return (
    <span
      className={cn(
        "inline-flex h-7 items-center gap-1.5 rounded-full px-2.5 text-[11px] font-medium",
        details.className
      )}
    >
      <Icon
        aria-hidden="true"
        className={cn(
          "size-3.5",
          isSpinning && "animate-spin motion-reduce:animate-none"
        )}
      />
      {details.label}
    </span>
  );
}

export function ActivityView() {
  const { uploads, jobs, isLoading, error, refresh } = useActivity();
  const { recordings } = useRecordings();
  const uploadManager = useUploadManager();
  const {
    activeVideoId,
    setActiveVideoId,
    setActiveJobId,
  } = useWorkspace();
  const [reprocessVideoId, setReprocessVideoId] =
    useState(activeVideoId);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  const selectedReprocessVideoId = recordings.some(
    (recording) => recording.id === reprocessVideoId
  )
    ? reprocessVideoId
    : recordings[0]?.id ?? "";

  const timeline = useMemo<TimelineItem[]>(() => {
    return [
      ...uploads.map((item) => ({
        kind: "upload" as const,
        date: item.updatedAt,
        item,
      })),
      ...jobs.map((item) => ({
        kind: "job" as const,
        date: item.createdAt,
        item,
      })),
    ].sort(
      (a, b) =>
        new Date(b.date).getTime() - new Date(a.date).getTime()
    );
  }, [jobs, uploads]);

  const activeUploads = uploads.filter((upload) =>
    ["initiated", "uploading", "completing"].includes(upload.status)
  ).length;
  const activeJobs = jobs.filter((job) =>
    [
      "awaiting_publication",
      "queued",
      "pending",
      "processing",
    ].includes(displayJobStatus(job))
  ).length;
  const completedJobs = jobs.filter(
    (job) => job.status === "completed"
  ).length;

  async function submitReprocess() {
    if (!selectedReprocessVideoId) return;
    setIsSubmitting(true);
    setSubmitError(null);

    try {
      const response = await fetch("/api/jobs", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ videoId: selectedReprocessVideoId }),
      });
      const payload = (await response.json()) as {
        jobId?: string;
        error?: string;
      };

      if (!response.ok || !payload.jobId) {
        throw new Error(
          payload.error ?? "Could not request reprocessing"
        );
      }

      setActiveVideoId(selectedReprocessVideoId);
      setActiveJobId(payload.jobId);
      notifyTrextonDataChanged();
      await refresh();
    } catch (requestError) {
      setSubmitError(
        requestError instanceof Error
          ? requestError.message
          : "Could not request reprocessing"
      );
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <div className="space-y-6">
      <header className="flex flex-col gap-4 border-b border-border pb-5 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-[-0.035em]">
            Activity
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Follow uploads and processing from one place.
          </p>
        </div>
        <button
          type="button"
          onClick={uploadManager.openDialog}
          className="inline-flex h-11 items-center gap-2 self-start rounded-lg bg-primary px-3.5 text-xs font-semibold text-primary-foreground shadow-sm transition-transform duration-[var(--motion-feedback)] hover:scale-[1.02] active:scale-[0.98] focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-ring/30 motion-reduce:transform-none sm:h-9 sm:self-auto"
        >
          <Plus aria-hidden="true" className="size-3.5" />
          New recording
        </button>
      </header>

      <section
        aria-label="Activity summary"
        className="grid overflow-hidden rounded-xl border border-border bg-card sm:grid-cols-3"
      >
        {[
          ["Uploading", activeUploads],
          ["In processing", activeJobs],
          ["Completed", completedJobs],
        ].map(([label, value], index) => (
          <div
            key={label}
            className={cn(
              "p-4",
              index > 0 && "border-t border-border sm:border-l sm:border-t-0"
            )}
          >
            <p className="text-xs text-muted-foreground">{label}</p>
            <p className="mt-1 text-xl font-semibold tabular-nums">
              {value}
            </p>
          </div>
        ))}
      </section>

      <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_19rem]">
        <section aria-labelledby="activity-feed-heading">
          <div className="mb-3 flex items-end justify-between gap-4">
            <div>
              <h2
                id="activity-feed-heading"
                className="text-sm font-semibold"
              >
                Recent activity
              </h2>
              <p className="mt-0.5 text-xs text-muted-foreground">
                Persisted upload and processing states
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

          {isLoading ? (
            <div className="space-y-2">
              {Array.from({ length: 4 }).map((_, index) => (
                <div
                  key={index}
                  className="h-24 animate-pulse rounded-xl border border-border bg-muted/55 motion-reduce:animate-none"
                />
              ))}
            </div>
          ) : error ? (
            <EmptyState
              icon={TriangleAlert}
              title="Activity could not be loaded"
              description={error}
            />
          ) : timeline.length === 0 ? (
            <EmptyState
              icon={CircleDashed}
              title="Nothing in motion"
              description="Upload a recording and its durable progress will appear here."
            />
          ) : (
            <div className="overflow-hidden rounded-xl border border-border bg-card">
              {timeline.map((entry, index) => {
                const status =
                  entry.kind === "job"
                    ? displayJobStatus(entry.item)
                    : entry.item.status;
                const canResume =
                  entry.kind === "upload" &&
                  ["initiated", "uploading", "completing"].includes(
                    entry.item.status
                  ) &&
                  uploadManager.savedSession?.sessionId ===
                    entry.item.id;

                return (
                  <article
                    key={`${entry.kind}-${entry.item.id}`}
                    className={cn(
                      "flex flex-col gap-3 p-4 sm:flex-row sm:items-center",
                      index > 0 && "border-t border-border"
                    )}
                  >
                    <div
                      className={cn(
                        "grid size-9 shrink-0 place-items-center rounded-xl",
                        entry.kind === "upload"
                          ? "bg-primary/10 text-primary"
                          : "bg-muted text-muted-foreground"
                      )}
                    >
                      {entry.kind === "upload" ? (
                        <CloudUpload
                          aria-hidden="true"
                          className="size-4"
                        />
                      ) : (
                        <Clapperboard
                          aria-hidden="true"
                          className="size-4"
                        />
                      )}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium">
                        {entry.kind === "upload"
                          ? entry.item.fileName
                          : entry.item.videoTitle ||
                            "Untitled recording"}
                      </p>
                      <p className="mt-1 text-xs text-muted-foreground">
                        {entry.kind === "upload"
                          ? `${formatFileSize(entry.item.fileSize)} · Upload`
                          : "Highlight processing"}
                        {" · "}
                        {formatRelativeDate(entry.date)}
                      </p>
                      {entry.kind === "job" &&
                      entry.item.status === "failed" ? (
                        <p className="mt-1 text-xs text-destructive">
                          Processing stopped before highlights were ready.
                        </p>
                      ) : null}
                    </div>
                    <div className="flex items-center gap-2">
                      <ActivityStatus
                        kind={entry.kind}
                        status={status}
                      />
                      {canResume ? (
                        <button
                          type="button"
                          onClick={uploadManager.openDialog}
                          className="h-8 rounded-lg px-2.5 text-xs font-medium text-primary hover:bg-primary/8 focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-ring/30"
                        >
                          Resume
                        </button>
                      ) : null}
                    </div>
                  </article>
                );
              })}
            </div>
          )}
        </section>

        <aside>
          <details className="rounded-xl border border-border bg-card p-4">
            <summary className="cursor-pointer list-none text-sm font-semibold focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-ring/30">
              <span className="inline-flex items-center gap-2">
                <RotateCcw
                  aria-hidden="true"
                  className="size-3.5 text-muted-foreground"
                />
                Reprocess a recording
              </span>
            </summary>
            <p className="mt-3 text-xs leading-5 text-muted-foreground">
              Upload completion starts processing automatically. Use this
              only when you intentionally want another run.
            </p>
            <label
              htmlFor="reprocess-recording"
              className="mt-4 block text-xs font-medium"
            >
              Recording
            </label>
            <select
              id="reprocess-recording"
              value={selectedReprocessVideoId}
              onChange={(event) =>
                setReprocessVideoId(event.target.value)
              }
              disabled={recordings.length === 0 || isSubmitting}
              className="mt-2 h-11 w-full rounded-lg border border-border bg-background px-3 text-xs outline-none focus:ring-3 focus:ring-ring/20"
            >
              {recordings.length === 0 ? (
                <option value="">No recordings available</option>
              ) : (
                recordings.map((recording) => (
                  <option key={recording.id} value={recording.id}>
                    {recording.title || "Untitled recording"}
                  </option>
                ))
              )}
            </select>
            {submitError ? (
              <p
                role="alert"
                className="mt-3 text-xs leading-5 text-destructive"
              >
                {submitError}
              </p>
            ) : null}
            <Button
              type="button"
              variant="outline"
              disabled={!selectedReprocessVideoId || isSubmitting}
              onClick={() => void submitReprocess()}
              className="mt-4 w-full"
            >
              {isSubmitting ? (
                <LoaderCircle
                  data-icon="inline-start"
                  aria-hidden="true"
                  className="animate-spin motion-reduce:animate-none"
                />
              ) : (
                <RotateCcw
                  data-icon="inline-start"
                  aria-hidden="true"
                />
              )}
              {isSubmitting ? "Requesting…" : "Reprocess"}
            </Button>
          </details>
        </aside>
      </div>
    </div>
  );
}

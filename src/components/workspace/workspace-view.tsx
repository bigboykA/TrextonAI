"use client";

import Link from "next/link";
import { ArrowRight, Film, Plus, Radio } from "lucide-react";
import { ClipsPanel } from "@/components/clips/clips-panel";
import { useUploadManager } from "@/components/providers/upload-provider";
import { useWorkspace } from "@/components/providers/workspace-provider";
import { useJob } from "@/hooks/use-job";
import { useRecordings } from "@/hooks/use-recordings";
import { formatFileSize, formatRelativeDate } from "@/lib/format";
import { RecordingStatus } from "@/components/videos/recording-status";

export function WorkspaceView() {
  const {
    activeVideoId,
    activeJobId,
    setActiveVideoId,
    setActiveJobId,
  } = useWorkspace();
  const { openDialog } = useUploadManager();
  const {
    recordings,
    isLoading: recordingsLoading,
    error: recordingsError,
  } = useRecordings();
  const selectedRecording =
    recordings.find((recording) => recording.id === activeVideoId) ??
    recordings[0] ??
    null;
  const selectedJobStatus =
    selectedRecording?.latestJob?.submissionStatus ??
    selectedRecording?.latestJob?.status;
  const selectedStatus = selectedJobStatus ?? "unprocessed";
  const { job, error } = useJob(
    selectedRecording?.latestJob?.id ?? activeJobId
  );
  const activityStatus = job?.submissionStatus ?? job?.status;

  return (
    <div className="space-y-7">
      <header className="flex flex-col gap-4 border-b border-border pb-5 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-[-0.035em]">
            Home
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Pick up where you left off.
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

      <div className="grid overflow-hidden rounded-xl border border-border bg-card lg:grid-cols-[minmax(0,1.4fr)_minmax(18rem,0.6fr)]">
        <section className="border-b border-border p-5 lg:border-b-0 lg:border-r">
          <div className="flex items-start justify-between gap-5">
            <div className="min-w-0">
              <p className="text-xs font-medium text-muted-foreground">
                Current source
              </p>
              <h2 className="mt-2 truncate text-base font-semibold">
                {recordingsLoading
                  ? "Loading recordings…"
                  : selectedRecording?.title || "Choose a recording"}
              </h2>
              {selectedRecording ? (
                <div className="mt-1.5 flex flex-wrap items-center gap-2">
                  <RecordingStatus status={selectedStatus} />
                  <span className="text-xs text-muted-foreground">
                    {formatRelativeDate(selectedRecording.createdAt)}
                    {selectedRecording.sourceSizeBytes
                      ? ` · ${formatFileSize(
                          selectedRecording.sourceSizeBytes
                        )}`
                      : ""}
                  </span>
                </div>
              ) : (
                <p className="mt-1 text-xs text-muted-foreground">
                  {recordingsError ??
                    "Upload a recording to establish a source."}
                </p>
              )}
            </div>
            <div className="grid size-10 place-items-center rounded-lg bg-primary/10 text-primary">
              <Film aria-hidden="true" className="size-4.5" />
            </div>
          </div>
          {recordings.length > 0 ? (
            <label className="mt-5 block border-t border-border pt-4">
              <span className="sr-only">Selected recording</span>
              <select
                value={selectedRecording?.id ?? ""}
                onChange={(event) => {
                  const recording = recordings.find(
                    (item) => item.id === event.target.value
                  );
                  if (!recording) return;
                  setActiveVideoId(recording.id);
                  setActiveJobId(recording.latestJob?.id ?? "");
                }}
                className="h-11 w-full rounded-lg border border-border bg-background px-3 text-sm outline-none focus:ring-3 focus:ring-ring/20 sm:h-9"
              >
                {recordings.map((recording) => (
                  <option key={recording.id} value={recording.id}>
                    {recording.title || "Untitled recording"}
                  </option>
                ))}
              </select>
            </label>
          ) : null}
          <div className="mt-4 flex flex-wrap gap-2">
            {selectedRecording ? (
              <Link
                href="/library?view=highlights"
                onClick={() => {
                  setActiveVideoId(selectedRecording.id);
                  setActiveJobId(
                    selectedRecording.latestJob?.id ?? ""
                  );
                }}
                className="inline-flex h-11 items-center gap-2 rounded-lg border border-border bg-background px-3 text-xs font-medium transition-colors duration-[var(--motion-feedback)] hover:border-primary/30 hover:text-primary focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-ring/30 sm:h-8"
              >
                View highlights
                <ArrowRight aria-hidden="true" className="size-3.5" />
              </Link>
            ) : (
              <button
                type="button"
                onClick={openDialog}
                className="inline-flex h-11 items-center gap-2 rounded-lg border border-border bg-background px-3 text-xs font-medium transition-colors duration-[var(--motion-feedback)] hover:border-primary/30 hover:text-primary focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-ring/30 sm:h-8"
              >
                Upload recording
                <ArrowRight aria-hidden="true" className="size-3.5" />
              </button>
            )}
            {selectedRecording ? (
              <button
                type="button"
                onClick={openDialog}
                className="inline-flex h-11 items-center rounded-lg px-3 text-xs font-medium text-muted-foreground hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-ring/30 sm:h-8"
              >
                Upload another
              </button>
            ) : null}
          </div>
        </section>

        <Link
          href="/processing"
          className="group p-5 transition-colors duration-[var(--motion-feedback)] hover:bg-muted/35 focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-inset focus-visible:ring-ring/30"
        >
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="text-xs font-medium text-muted-foreground">
                Activity
              </p>
              {job ? (
                <>
                  <h2 className="mt-2 text-sm font-semibold">
                    {activityStatus === "completed"
                      ? "Highlights ready"
                      : activityStatus === "failed"
                        ? "Needs attention"
                        : activityStatus === "processing"
                          ? "Processing recording"
                          : activityStatus === "queued"
                            ? "Queued for processing"
                            : "Waiting for processing"}
                  </h2>
                  <div className="mt-2">
                    <RecordingStatus
                      status={activityStatus ?? "unprocessed"}
                    />
                  </div>
                </>
              ) : (
                <>
                  <h2 className="mt-2 text-sm font-semibold">
                    {error ? "Status unavailable" : "Nothing in motion"}
                  </h2>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {error ?? "Start a run when your source is ready."}
                  </p>
                </>
              )}
            </div>
            <Radio
              aria-hidden="true"
              className="size-4 text-muted-foreground transition-colors group-hover:text-primary"
            />
          </div>
        </Link>
      </div>

      <section className="border-t border-border pt-6">
        <ClipsPanel
          limit={3}
          videoId={selectedRecording?.id}
          processingStatus={selectedJobStatus}
          sourceTitle={selectedRecording?.title ?? undefined}
        />
      </section>
    </div>
  );
}

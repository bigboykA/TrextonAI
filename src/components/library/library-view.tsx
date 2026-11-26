"use client";

import { useEffect, useState } from "react";
import {
  Film,
  Plus,
  TriangleAlert,
} from "lucide-react";
import { ClipsPanel } from "@/components/clips/clips-panel";
import { useUploadManager } from "@/components/providers/upload-provider";
import { useWorkspace } from "@/components/providers/workspace-provider";
import { EmptyState } from "@/components/ui/empty-state";
import { Tabs } from "@/components/ui/tabs";
import { RecordingStatus } from "@/components/videos/recording-status";
import { useRecordings } from "@/hooks/use-recordings";
import {
  formatDuration,
  formatFileSize,
  formatRelativeDate,
} from "@/lib/format";
import { cn } from "@/lib/utils";

export function LibraryView({
  initialSection = "recordings",
}: {
  initialSection?: "recordings" | "highlights";
}) {
  const { recordings, isLoading, error, refresh } = useRecordings();
  const {
    activeVideoId,
    setActiveVideoId,
    setActiveJobId,
  } = useWorkspace();
  const { openDialog } = useUploadManager();
  const [librarySection, setLibrarySection] = useState<
    "recordings" | "highlights"
  >(initialSection);

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
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <Tabs
              value={librarySection}
              onValueChange={(value) =>
                setLibrarySection(
                  value as "recordings" | "highlights"
                )
              }
              tabs={[
                { title: "Recordings", value: "recordings" },
                { title: "Highlights", value: "highlights" },
              ]}
              ariaLabel="Library content"
              idBase="library-section"
              panelId="library-section-panel"
              containerClassName="self-start"
            />
            <button
              type="button"
              onClick={() => void refresh()}
              className="h-11 self-start rounded-lg px-3 text-xs font-medium text-muted-foreground hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-ring/30 sm:h-8"
            >
              Refresh
            </button>
          </div>

          {librarySection === "recordings" ? (
            <section
              id="library-section-panel"
              role="tabpanel"
              aria-labelledby="library-section-recordings"
              className="mt-5"
            >
              <div className="mb-3">
                <h2 className="text-sm font-semibold">
                  Original recordings
                </h2>
                <p className="mt-0.5 text-xs text-muted-foreground">
                  Choose a recording to open its generated highlights.
                </p>
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
                      aria-label={`View highlights for ${
                        recording.title || "untitled recording"
                      }`}
                      onClick={() => {
                        setActiveVideoId(recording.id);
                        setActiveJobId(recording.latestJob?.id ?? "");
                        setLibrarySection("highlights");
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
                            {recording.duration &&
                            Number.isFinite(Number(recording.duration))
                              ? ` · ${formatDuration(Number(recording.duration))}`
                              : ""}
                          </p>
                        </div>
                      </div>
                      <div className="mt-4 flex items-center justify-between border-t border-border pt-3">
                        <RecordingStatus status={status} />
                        <span className="text-[11px] text-muted-foreground">
                          {recording.clipCount}{" "}
                          {recording.clipCount === 1
                            ? "highlight"
                            : "highlights"}
                        </span>
                      </div>
                    </button>
                  );
                })}
              </div>
            </section>
          ) : (
            <section
              id="library-section-panel"
              role="tabpanel"
              aria-labelledby="library-section-highlights"
              className="mt-5"
            >
              <div className="mb-5 flex flex-col gap-3 rounded-xl border border-border bg-card p-4 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <h2 className="text-sm font-semibold">
                    Highlight source
                  </h2>
                  <p className="mt-0.5 text-xs text-muted-foreground">
                    Generated clips stay associated with their original
                    recording.
                  </p>
                </div>
                <label className="sm:min-w-64">
                  <span className="sr-only">Highlight source recording</span>
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
                    className="h-11 w-full rounded-lg border border-border bg-background px-3 text-xs outline-none focus:ring-3 focus:ring-ring/20 sm:h-9"
                  >
                    {recordings.map((recording) => (
                      <option key={recording.id} value={recording.id}>
                        {recording.title || "Untitled recording"}
                      </option>
                    ))}
                  </select>
                </label>
              </div>
              <ClipsPanel
                processingStatus={selectedStatus}
                sourceTitle={
                  selectedRecording?.title || "Untitled recording"
                }
                videoId={selectedRecording?.id}
              />
            </section>
          )}
        </>
      )}
    </div>
  );
}

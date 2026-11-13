"use client";

import Link from "next/link";
import {
  ArrowLeft,
  Download,
  FileText,
  Film,
  Timer,
} from "lucide-react";
import { ClipPlayer } from "@/components/clips/clip-player";
import { EmptyState } from "@/components/ui/empty-state";
import { useWorkspace } from "@/components/providers/workspace-provider";
import { useClips } from "@/hooks/use-clips";
import {
  formatDuration,
  formatRelativeDate,
  formatTimestamp,
  truncateIdentifier,
} from "@/lib/format";

export function ClipReview({ clipId }: { clipId: string }) {
  const { activeVideoId } = useWorkspace();
  const { clips, isLoading, error } = useClips(activeVideoId);
  const clip = clips.find((item) => item.id === clipId);
  const videoUrl = `/api/clips/${clipId}/video`;

  if (isLoading) {
    return (
      <div className="space-y-4">
        <div className="h-9 w-56 animate-pulse rounded-lg bg-muted motion-reduce:animate-none" />
        <div className="aspect-video animate-pulse rounded-xl bg-muted motion-reduce:animate-none" />
      </div>
    );
  }

  if (activeVideoId && (error || (!isLoading && !clip))) {
    return (
      <EmptyState
        icon={Film}
        title="Clip details unavailable"
        description={
          error ??
          "This clip does not belong to the recording currently selected in the workspace."
        }
        action={{ label: "Return to library", href: "/library" }}
      />
    );
  }

  return (
    <div className="space-y-5">
      <header className="flex items-center justify-between gap-4 border-b border-border pb-4">
        <div className="flex min-w-0 items-center gap-3">
          <Link
            href="/library"
            aria-label="Back to library"
            className="grid size-11 shrink-0 place-items-center rounded-lg text-muted-foreground transition-colors duration-[var(--motion-feedback)] hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-ring/30 sm:size-8"
          >
            <ArrowLeft aria-hidden="true" className="size-4" />
          </Link>
          <div className="min-w-0">
            <p className="text-xs font-medium text-primary">
              Clip review
            </p>
            <h1 className="mt-0.5 truncate text-base font-semibold">
              {clip?.reason || "Generated highlight"}
            </h1>
          </div>
        </div>
        <a
          href={videoUrl}
          download={
            clip ? `trexton-highlight-${clip.rank}.mp4` : "trexton-clip.mp4"
          }
          className="inline-flex h-11 items-center gap-2 rounded-lg border border-border bg-card px-3 text-xs font-medium transition-colors duration-[var(--motion-feedback)] hover:border-primary/30 hover:text-primary focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-ring/30 sm:h-8"
        >
          <Download aria-hidden="true" className="size-3.5" />
          Download
        </a>
      </header>

      <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_19rem]">
        <ClipPlayer
          src={videoUrl}
          title={clip?.reason || "Generated clip"}
        />

        <aside className="rounded-xl border border-border bg-card">
          <div className="border-b border-border p-4">
            <h2 className="text-sm font-semibold">Clip details</h2>
          </div>
          <dl className="divide-y divide-border text-xs">
            <div className="flex items-center justify-between gap-4 p-4">
              <dt className="flex items-center gap-2 text-muted-foreground">
                <Timer aria-hidden="true" className="size-3.5" />
                Duration
              </dt>
              <dd className="font-medium">
                {clip
                  ? formatDuration(clip.end - clip.start)
                  : "From media"}
              </dd>
            </div>
            {clip ? (
              <>
                <div className="flex items-center justify-between gap-4 p-4">
                  <dt className="text-muted-foreground">Source range</dt>
                  <dd className="font-mono text-xs">
                    {formatTimestamp(clip.start)}–{formatTimestamp(clip.end)}
                  </dd>
                </div>
                <div className="flex items-center justify-between gap-4 p-4">
                  <dt className="text-muted-foreground">Created</dt>
                  <dd>{formatRelativeDate(clip.createdAt)}</dd>
                </div>
                <div className="p-4">
                  <dt className="text-muted-foreground">Source recording</dt>
                  <dd className="mt-1.5 font-mono text-xs">
                    {truncateIdentifier(clip.videoId)}
                  </dd>
                </div>
              </>
            ) : (
              <div className="p-4 text-muted-foreground">
                Connect this clip&apos;s source in Settings to load its
                metadata and transcript.
              </div>
            )}
          </dl>
        </aside>
      </div>

      <section className="rounded-xl border border-border bg-card">
        <div className="flex items-center gap-2 border-b border-border px-4 py-3">
          <FileText
            aria-hidden="true"
            className="size-3.5 text-muted-foreground"
          />
          <h2 className="text-sm font-semibold">Transcript</h2>
        </div>
        <div className="min-h-24 p-4">
          <p className="max-w-4xl text-sm leading-6 text-muted-foreground">
            {clip?.transcriptText ||
              "No transcript text is available for this clip."}
          </p>
        </div>
      </section>
    </div>
  );
}

"use client";

import {
  Download,
  Play,
  Quote,
  Timer,
} from "lucide-react";
import { useState } from "react";
import { BrandMark } from "@/components/brand/brand-mark";
import type { GeneratedClip } from "@/lib/frontend-types";
import {
  formatDuration,
  formatRelativeDate,
  formatTimestamp,
} from "@/lib/format";

export function ClipCard({ clip }: { clip: GeneratedClip }) {
  const [isPreviewLoaded, setIsPreviewLoaded] = useState(false);
  const videoUrl = `/api/clips/${clip.id}/video`;
  const duration = clip.end - clip.start;

  return (
    <article className="group overflow-hidden rounded-3xl border border-border/80 bg-card shadow-[0_1px_1px_color-mix(in_oklch,var(--foreground),transparent_94%)]">
      <div className="relative aspect-video overflow-hidden bg-[radial-gradient(circle_at_70%_15%,color-mix(in_oklch,var(--primary),transparent_72%),transparent_42%),linear-gradient(145deg,var(--preview-from),var(--preview-to))]">
        {isPreviewLoaded ? (
          <video
            className="size-full bg-black object-contain"
            src={videoUrl}
            controls
            autoPlay
            playsInline
            preload="metadata"
            aria-label={`Preview cut ${clip.rank}`}
          />
        ) : (
          <button
            type="button"
            onClick={() => setIsPreviewLoaded(true)}
            className="absolute inset-0 flex size-full items-center justify-center focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-inset focus-visible:ring-primary"
            aria-label={`Load preview for cut ${clip.rank}`}
          >
            <BrandMark className="absolute -right-6 -top-8 size-36 rotate-12 text-white/[0.045] transition-transform duration-500 group-hover:rotate-6 group-hover:scale-105 motion-reduce:transform-none motion-reduce:transition-none" />
            <span className="grid size-14 place-items-center rounded-full border border-white/15 bg-black/35 text-white shadow-xl backdrop-blur-md transition-transform duration-200 group-hover:scale-105 motion-reduce:transform-none">
              <Play
                aria-hidden="true"
                className="ml-0.5 size-5 fill-current"
              />
            </span>
            <span className="absolute bottom-3 left-3 rounded-full bg-black/55 px-2.5 py-1 text-[0.68rem] font-medium tracking-wide text-white/90 backdrop-blur-md">
              {formatTimestamp(clip.start)}–{formatTimestamp(clip.end)}
            </span>
          </button>
        )}
      </div>

      <div className="p-5">
        <div className="flex items-start justify-between gap-4">
          <div className="min-w-0">
            <p className="text-[0.68rem] font-semibold uppercase tracking-[0.16em] text-primary">
              Cut {clip.rank.toString().padStart(2, "0")}
            </p>
            <h3 className="mt-2 truncate text-base font-semibold tracking-tight">
              {clip.reason || `Generated cut ${clip.rank}`}
            </h3>
          </div>
          <a
            href={videoUrl}
            download={`trexton-highlight-${clip.rank}.mp4`}
            aria-label={`Download cut ${clip.rank}`}
            className="grid size-9 shrink-0 place-items-center rounded-full border border-border bg-background text-muted-foreground transition-all hover:-translate-y-0.5 hover:border-primary/30 hover:text-primary focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-ring/30 motion-reduce:transform-none"
          >
            <Download aria-hidden="true" className="size-4" />
          </a>
        </div>

        {clip.transcriptText ? (
          <div className="mt-4 flex gap-2.5 text-sm leading-6 text-muted-foreground">
            <Quote
              aria-hidden="true"
              className="mt-1 size-3.5 shrink-0 text-primary/75"
            />
            <p className="line-clamp-2">{clip.transcriptText}</p>
          </div>
        ) : null}

        <div className="mt-5 flex items-center gap-4 border-t border-border/70 pt-4 text-xs text-muted-foreground">
          <span className="inline-flex items-center gap-1.5">
            <Timer aria-hidden="true" className="size-3.5" />
            {formatDuration(duration)}
          </span>
          <span aria-hidden="true" className="size-1 rounded-full bg-border" />
          <span>{formatRelativeDate(clip.createdAt)}</span>
        </div>
      </div>
    </article>
  );
}

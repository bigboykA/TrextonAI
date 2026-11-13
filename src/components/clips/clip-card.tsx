"use client";

import Link from "next/link";
import {
  ArrowUpRight,
  Download,
  Play,
  Timer,
} from "lucide-react";
import { BrandMark } from "@/components/brand/brand-mark";
import { cn } from "@/lib/utils";
import type { GeneratedClip } from "@/lib/frontend-types";
import {
  formatDuration,
  formatRelativeDate,
  formatTimestamp,
} from "@/lib/format";

export function ClipCard({
  clip,
  view = "grid",
}: {
  clip: GeneratedClip;
  view?: "grid" | "list";
}) {
  const videoUrl = `/api/clips/${clip.id}/video`;
  const duration = clip.end - clip.start;

  return (
    <article
      className={cn(
        "group overflow-hidden rounded-xl border border-border/80 bg-card shadow-[0_1px_1px_color-mix(in_oklch,var(--foreground),transparent_95%)] transition-[border-color,box-shadow] duration-[var(--motion-feedback)] hover:border-primary/25 hover:shadow-[0_10px_30px_color-mix(in_oklch,var(--foreground),transparent_94%)]",
        view === "list" && "grid sm:grid-cols-[15rem_minmax(0,1fr)]"
      )}
    >
      <div className="relative aspect-video overflow-hidden bg-[radial-gradient(circle_at_70%_15%,color-mix(in_oklch,var(--primary),transparent_72%),transparent_42%),linear-gradient(145deg,var(--preview-from),var(--preview-to))]">
        <video
          className="size-full bg-black/20 object-cover opacity-80 transition duration-[var(--motion-view)] group-hover:scale-[1.015] group-hover:opacity-100 motion-reduce:transform-none"
          src={videoUrl}
          muted
          playsInline
          preload="metadata"
          aria-hidden="true"
          tabIndex={-1}
        />
        <BrandMark className="pointer-events-none absolute -right-5 -top-7 size-28 rotate-6 text-white/[0.045]" />
        <Link
          href={`/clips/${clip.id}`}
          className="absolute inset-0 flex items-center justify-center focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-inset focus-visible:ring-primary"
          aria-label={`Review clip ${clip.rank}`}
        >
          <span className="grid size-11 place-items-center rounded-full border border-white/15 bg-black/40 text-white opacity-90 shadow-xl backdrop-blur-md transition-[transform,opacity] duration-[var(--motion-feedback)] group-hover:scale-105 group-hover:opacity-100 motion-reduce:transform-none">
              <Play
                aria-hidden="true"
              className="ml-0.5 size-4 fill-current"
              />
          </span>
        </Link>
        <span className="absolute bottom-2.5 left-2.5 rounded-md bg-black/62 px-2 py-1 font-mono text-[0.62rem] text-white/90 backdrop-blur-md">
          {formatTimestamp(clip.start)}–{formatTimestamp(clip.end)}
        </span>
        <span className="absolute bottom-2.5 right-2.5 rounded-md bg-black/62 px-2 py-1 font-mono text-[0.62rem] text-white/90 backdrop-blur-md">
          {formatDuration(duration)}
        </span>
      </div>

      <div className="flex min-w-0 flex-col p-4">
        <div className="flex items-start justify-between gap-4">
          <div className="min-w-0">
            <p className="text-xs font-medium text-primary">
              Highlight {clip.rank.toString().padStart(2, "0")}
            </p>
            <Link href={`/clips/${clip.id}`} className="group/title">
              <h3 className="mt-1.5 line-clamp-1 text-sm font-semibold tracking-tight group-hover/title:text-primary">
                {clip.reason || `Generated clip ${clip.rank}`}
              </h3>
            </Link>
          </div>
          <div className="flex shrink-0 items-center gap-1">
            <Link
              href={`/clips/${clip.id}`}
              aria-label={`Open clip ${clip.rank}`}
              className="grid size-11 place-items-center rounded-lg text-muted-foreground transition-colors duration-[var(--motion-feedback)] hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-ring/30 sm:size-8"
            >
              <ArrowUpRight aria-hidden="true" className="size-3.5" />
            </Link>
            <a
              href={videoUrl}
              download={`trexton-highlight-${clip.rank}.mp4`}
              aria-label={`Download clip ${clip.rank}`}
              className="grid size-11 place-items-center rounded-lg text-muted-foreground transition-colors duration-[var(--motion-feedback)] hover:bg-muted hover:text-primary focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-ring/30 sm:size-8"
            >
              <Download aria-hidden="true" className="size-3.5" />
            </a>
          </div>
        </div>

        {clip.transcriptText ? (
          <p className="mt-2 line-clamp-2 text-xs leading-5 text-muted-foreground">
            {clip.transcriptText}
          </p>
        ) : null}

        <div className="mt-auto flex items-center gap-3 pt-3 text-xs text-muted-foreground">
          <span className="inline-flex items-center gap-1.5">
            <Timer aria-hidden="true" className="size-3" />
            {formatDuration(duration)}
          </span>
          <span>{formatRelativeDate(clip.createdAt)}</span>
        </div>
      </div>
    </article>
  );
}

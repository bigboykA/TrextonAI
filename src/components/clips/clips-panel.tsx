"use client";

import { Film, RefreshCw, TriangleAlert } from "lucide-react";
import { useClips } from "@/hooks/use-clips";
import { useWorkspace } from "@/components/providers/workspace-provider";
import { EmptyState } from "@/components/ui/empty-state";
import { ClipGrid } from "./clip-grid";

function ClipSkeletons({ count = 3 }: { count?: number }) {
  return (
    <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-3">
      {Array.from({ length: count }).map((_, index) => (
        <div
          key={index}
          className="overflow-hidden rounded-3xl border border-border bg-card"
        >
          <div className="aspect-video animate-pulse bg-muted motion-reduce:animate-none" />
          <div className="space-y-3 p-5">
            <div className="h-3 w-24 animate-pulse rounded-full bg-muted motion-reduce:animate-none" />
            <div className="h-5 w-2/3 animate-pulse rounded-full bg-muted motion-reduce:animate-none" />
            <div className="h-10 animate-pulse rounded-xl bg-muted motion-reduce:animate-none" />
          </div>
        </div>
      ))}
    </div>
  );
}

export function ClipsPanel({
  limit,
  showHeader = true,
}: {
  limit?: number;
  showHeader?: boolean;
}) {
  const { activeVideoId } = useWorkspace();
  const { clips, isLoading, error, refresh } =
    useClips(activeVideoId);
  const visibleClips =
    typeof limit === "number" ? clips.slice(0, limit) : clips;

  return (
    <section aria-labelledby="highlights-heading">
      {showHeader ? (
        <div className="mb-5 flex items-end justify-between gap-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-muted-foreground">
              Latest from the cut room
            </p>
            <h2
              id="highlights-heading"
              className="mt-2 text-xl font-semibold tracking-tight"
            >
              Recent cuts
            </h2>
          </div>
          {activeVideoId ? (
            <button
              type="button"
              onClick={refresh}
              disabled={isLoading}
              className="inline-flex h-9 items-center gap-2 rounded-full border border-border bg-card px-3 text-xs font-medium text-muted-foreground transition-colors hover:text-foreground disabled:opacity-50 focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-ring/30"
            >
              <RefreshCw
                aria-hidden="true"
                className={`size-3.5 ${
                  isLoading
                    ? "animate-spin motion-reduce:animate-none"
                    : ""
                }`}
              />
              Refresh
            </button>
          ) : null}
        </div>
      ) : null}

      {!activeVideoId ? (
        <EmptyState
          icon={Film}
          title="Choose a video source"
          description="Connect an existing recording and its finished cuts will gather here."
          action={{ label: "Open settings", href: "/settings" }}
        />
      ) : isLoading ? (
        <ClipSkeletons count={limit ?? 3} />
      ) : error ? (
        <EmptyState
          icon={TriangleAlert}
          title="Highlights could not be loaded"
          description={`${error}. Check that PostgreSQL and the Next.js server are running, then try again.`}
        />
      ) : visibleClips.length === 0 ? (
        <EmptyState
          icon={Film}
          title="No highlights yet"
          description="This recording has not made the cut yet. Start an activity and Trexton will bring back its strongest moments."
          action={{
            label: "Process this video",
            href: "/processing",
          }}
        />
      ) : (
        <ClipGrid clips={visibleClips} />
      )}
    </section>
  );
}

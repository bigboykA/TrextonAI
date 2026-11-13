"use client";

import {
  Film,
  Grid2X2,
  List,
  RefreshCw,
  Search,
  SearchX,
  TriangleAlert,
} from "lucide-react";
import { useMemo, useState } from "react";
import { useClips } from "@/hooks/use-clips";
import { useWorkspace } from "@/components/providers/workspace-provider";
import { EmptyState } from "@/components/ui/empty-state";
import { Tabs } from "@/components/ui/tabs";
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
  const {
    activeVideoId,
    librarySearch,
    setLibrarySearch,
  } = useWorkspace();
  const { clips, isLoading, error, refresh } =
    useClips(activeVideoId);
  const [filter, setFilter] = useState("all");
  const [sort, setSort] = useState("newest");
  const [view, setView] = useState<"grid" | "list">("grid");
  const showControls = typeof limit !== "number";

  const visibleClips = useMemo(() => {
    const query = librarySearch.trim().toLowerCase();
    const nextClips = clips.filter((clip) => {
      const duration = clip.end - clip.start;
      const matchesFilter =
        filter === "all" ||
        (filter === "short" && duration < 60) ||
        (filter === "long" && duration >= 60);
      const matchesSearch =
        !query ||
        clip.reason.toLowerCase().includes(query) ||
        clip.transcriptText?.toLowerCase().includes(query);

      return matchesFilter && matchesSearch;
    });

    nextClips.sort((a, b) => {
      if (sort === "rank") return a.rank - b.rank;
      if (sort === "duration") {
        return b.end - b.start - (a.end - a.start);
      }
      return (
        new Date(b.createdAt).getTime() -
        new Date(a.createdAt).getTime()
      );
    });

    return typeof limit === "number"
      ? nextClips.slice(0, limit)
      : nextClips;
  }, [clips, filter, librarySearch, limit, sort]);

  const hasFilterTabs =
    showControls &&
    Boolean(activeVideoId) &&
    !isLoading &&
    !error &&
    clips.length > 0;

  return (
    <section
      aria-labelledby={showHeader ? "highlights-heading" : undefined}
      aria-label={showHeader ? undefined : "Clips"}
    >
      {showHeader ? (
        <div className="mb-4 flex items-end justify-between gap-4">
          <div>
            <h2
              id="highlights-heading"
              className="text-base font-semibold tracking-tight"
            >
              Recent highlights
            </h2>
            <p className="mt-1 text-xs text-muted-foreground">
              Ready for review
            </p>
          </div>
          {activeVideoId ? (
            <button
              type="button"
              onClick={refresh}
              disabled={isLoading}
              className="inline-flex h-11 items-center gap-2 rounded-lg px-2.5 text-xs font-medium text-muted-foreground transition-colors duration-[var(--motion-feedback)] hover:bg-muted hover:text-foreground disabled:opacity-50 focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-ring/30 sm:h-8"
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

      {showControls && activeVideoId && !isLoading && !error && clips.length ? (
        <div className="mb-4 space-y-3 border-b border-border pb-4">
          <div className="relative md:hidden">
            <Search
              aria-hidden="true"
              className="pointer-events-none absolute left-3 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground"
            />
            <input
              value={librarySearch}
              onChange={(event) => setLibrarySearch(event.target.value)}
              aria-label="Search clips"
              placeholder="Search clips"
              className="h-11 w-full rounded-lg border border-border bg-background pl-9 pr-3 text-sm outline-none placeholder:text-muted-foreground focus:ring-3 focus:ring-ring/15"
            />
          </div>
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <Tabs
              value={filter}
              onValueChange={setFilter}
              tabs={[
                { title: "All", value: "all" },
                { title: "Under 1 min", value: "short" },
                { title: "1 min +", value: "long" },
              ]}
              ariaLabel="Clip duration"
              idBase="clip-duration-filter"
              panelId="clips-results"
            />
            <div className="flex items-center gap-2">
              <label className="sr-only" htmlFor="clip-sort">
                Sort clips
              </label>
              <select
                id="clip-sort"
                value={sort}
                onChange={(event) => setSort(event.target.value)}
                className="h-11 rounded-lg border border-border bg-background px-2.5 text-xs text-muted-foreground outline-none focus:ring-3 focus:ring-ring/20 sm:h-8"
              >
                <option value="newest">Newest</option>
                <option value="rank">Best ranked</option>
                <option value="duration">Longest</option>
              </select>
              <div className="flex rounded-lg border border-border p-0.5">
                <button
                  type="button"
                  onClick={() => setView("grid")}
                  aria-label="Grid view"
                  aria-pressed={view === "grid"}
                  className={`grid size-11 place-items-center rounded-md transition-colors duration-[var(--motion-feedback)] sm:size-8 ${
                    view === "grid"
                      ? "bg-muted text-foreground"
                      : "text-muted-foreground hover:text-foreground"
                  }`}
                >
                  <Grid2X2 aria-hidden="true" className="size-3.5" />
                </button>
                <button
                  type="button"
                  onClick={() => setView("list")}
                  aria-label="List view"
                  aria-pressed={view === "list"}
                  className={`grid size-11 place-items-center rounded-md transition-colors duration-[var(--motion-feedback)] sm:size-8 ${
                    view === "list"
                      ? "bg-muted text-foreground"
                      : "text-muted-foreground hover:text-foreground"
                  }`}
                >
                  <List aria-hidden="true" className="size-3.5" />
                </button>
              </div>
            </div>
          </div>
        </div>
      ) : null}

      <div
        id="clips-results"
        role={hasFilterTabs ? "tabpanel" : undefined}
        aria-labelledby={
          hasFilterTabs ? `clip-duration-filter-${filter}` : undefined
        }
      >
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
            icon={librarySearch || filter !== "all" ? SearchX : Film}
            title={
              librarySearch || filter !== "all"
                ? "No matching clips"
                : "No highlights yet"
            }
            description={
              librarySearch || filter !== "all"
                ? "Try a different search or filter."
                : "Process this recording to bring its strongest moments into the library."
            }
            action={
              librarySearch || filter !== "all"
                ? undefined
                : {
                    label: "Process this video",
                    href: "/processing",
                  }
            }
          />
        ) : (
          <ClipGrid clips={visibleClips} view={view} />
        )}
      </div>
    </section>
  );
}

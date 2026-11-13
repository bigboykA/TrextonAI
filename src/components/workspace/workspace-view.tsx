"use client";

import Link from "next/link";
import { ArrowRight, Film, Plus, Radio } from "lucide-react";
import { ClipsPanel } from "@/components/clips/clips-panel";
import { useWorkspace } from "@/components/providers/workspace-provider";
import { StatusPill } from "@/components/ui/status-pill";
import { useJob } from "@/hooks/use-job";

export function WorkspaceView() {
  const { activeVideoId, activeJobId } = useWorkspace();
  const { job, error } = useJob(activeJobId);

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
        <Link
          href="/processing"
          className="inline-flex h-11 items-center gap-2 self-start rounded-lg bg-primary px-3.5 text-xs font-semibold text-primary-foreground shadow-sm transition-transform duration-[var(--motion-feedback)] hover:scale-[1.02] active:scale-[0.98] focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-ring/30 motion-reduce:transform-none sm:h-9 sm:self-auto"
        >
          <Plus aria-hidden="true" className="size-3.5" />
          New activity
        </Link>
      </header>

      <div className="grid overflow-hidden rounded-xl border border-border bg-card lg:grid-cols-[minmax(0,1.4fr)_minmax(18rem,0.6fr)]">
        <section className="border-b border-border p-5 lg:border-b-0 lg:border-r">
          <div className="flex items-start justify-between gap-5">
            <div>
              <p className="text-xs font-medium text-muted-foreground">
                Current source
              </p>
              <h2 className="mt-2 text-base font-semibold">
                {activeVideoId ? "Recording connected" : "Choose a recording"}
              </h2>
              <p className="mt-1 text-xs text-muted-foreground">
                {activeVideoId
                  ? "Local recording ready"
                  : "No local video selected"}
              </p>
            </div>
            <div className="grid size-10 place-items-center rounded-lg bg-primary/10 text-primary">
              <Film aria-hidden="true" className="size-4.5" />
            </div>
          </div>
          <div className="mt-5 flex flex-wrap gap-2 border-t border-border pt-4">
            <Link
              href={activeVideoId ? "/processing" : "/settings"}
              className="inline-flex h-11 items-center gap-2 rounded-lg border border-border bg-background px-3 text-xs font-medium transition-colors duration-[var(--motion-feedback)] hover:border-primary/30 hover:text-primary focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-ring/30 sm:h-8"
            >
              {activeVideoId ? "Process recording" : "Select source"}
              <ArrowRight aria-hidden="true" className="size-3.5" />
            </Link>
            {activeVideoId ? (
              <Link
                href="/library"
                className="inline-flex h-11 items-center rounded-lg px-3 text-xs font-medium text-muted-foreground hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-ring/30 sm:h-8"
              >
                Open library
              </Link>
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
                    {job.status === "completed"
                      ? "Highlights ready"
                      : job.status === "failed"
                        ? "Needs attention"
                        : "Processing recording"}
                  </h2>
                  <div className="mt-2">
                    <StatusPill status={job.status} />
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
        <ClipsPanel limit={3} />
      </section>
    </div>
  );
}

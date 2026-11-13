"use client";

import Link from "next/link";
import {
  ArrowRight,
  CheckCircle2,
  CircleDashed,
  Clapperboard,
  LoaderCircle,
  TriangleAlert,
} from "lucide-react";
import {
  FormEvent,
  useCallback,
  useEffect,
  useState,
} from "react";
import { motion, useReducedMotion } from "motion/react";
import { Button } from "@/components/ui/button";
import { PageHeader } from "@/components/ui/page-header";
import { StatusPill } from "@/components/ui/status-pill";
import { useWorkspace } from "@/components/providers/workspace-provider";
import type { ProcessingJob } from "@/lib/frontend-types";
import { truncateIdentifier } from "@/lib/format";

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export function ProcessingView() {
  const {
    activeVideoId,
    setActiveVideoId,
    activeJobId,
    setActiveJobId,
  } = useWorkspace();
  const [draftVideoId, setDraftVideoId] = useState<string | null>(
    null
  );
  const [job, setJob] = useState<ProcessingJob | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const shouldReduceMotion = useReducedMotion();
  const videoId = draftVideoId ?? activeVideoId;

  const loadJob = useCallback(async () => {
    if (!activeJobId) {
      return;
    }

    try {
      const response = await fetch(`/api/jobs/${activeJobId}`, {
        cache: "no-store",
      });

      if (!response.ok) {
        const result = (await response.json().catch(() => null)) as
          | { error?: string }
          | null;
        throw new Error(
          result?.error ?? "Could not retrieve processing status"
        );
      }

      const nextJob = (await response.json()) as ProcessingJob;
      setJob(nextJob);
      setError(null);
    } catch (loadError) {
      setError(
        loadError instanceof Error
          ? loadError.message
          : "Could not retrieve processing status"
      );
    }
  }, [activeJobId]);

  useEffect(() => {
    const initialCheck = window.setTimeout(loadJob, 0);
    return () => window.clearTimeout(initialCheck);
  }, [loadJob]);

  useEffect(() => {
    if (
      !activeJobId ||
      (job && !["pending", "processing"].includes(job.status))
    ) {
      return;
    }

    const interval = window.setInterval(loadJob, 2500);
    return () => window.clearInterval(interval);
  }, [activeJobId, job, loadJob]);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const normalizedVideoId = videoId.trim();

    if (!UUID_PATTERN.test(normalizedVideoId)) {
      setError("Enter a valid video UUID before processing.");
      return;
    }

    setIsSubmitting(true);
    setError(null);
    setJob(null);

    try {
      const response = await fetch("/api/jobs", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ videoId: normalizedVideoId }),
      });

      const result = (await response.json()) as {
        jobId?: string;
        error?: string;
      };

      if (!response.ok || !result.jobId) {
        throw new Error(
          result.error ?? "Could not start video processing"
        );
      }

      setActiveVideoId(normalizedVideoId);
      setActiveJobId(result.jobId);
      setDraftVideoId(null);
      setJob({
        id: result.jobId,
        videoId: normalizedVideoId,
        status: "pending",
        errorMessage: null,
        createdAt: new Date().toISOString(),
        completedAt: null,
      });
    } catch (submitError) {
      setError(
        submitError instanceof Error
          ? submitError.message
          : "Could not start video processing"
      );
    } finally {
      setIsSubmitting(false);
    }
  }

  const isActive =
    isSubmitting ||
    job?.status === "pending" ||
    job?.status === "processing";

  return (
    <div className="space-y-10">
      <PageHeader
        eyebrow="Activity"
        title="Set the work in motion. Come back to the cut."
        description="Choose a recording already known to this local workspace. Trexton handles the long listen, then returns with a short list worth your attention."
      />

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1.15fr)_minmax(21rem,0.85fr)]">
        <section className="rounded-3xl border border-border bg-card p-5 shadow-sm sm:p-7">
          <div className="flex items-start gap-4">
            <div className="grid size-11 shrink-0 place-items-center rounded-2xl bg-primary/10 text-primary">
              <Clapperboard
                aria-hidden="true"
                className="size-5"
              />
            </div>
            <div>
              <h2 className="text-lg font-semibold tracking-tight">
                Choose the recording
              </h2>
              <p className="mt-1 text-sm leading-6 text-muted-foreground">
                Enter the UUID of a video already stored in PostgreSQL.
              </p>
            </div>
          </div>

          <form onSubmit={handleSubmit} className="mt-8">
            <label
              htmlFor="video-id"
              className="text-sm font-medium"
            >
              Video ID
            </label>
            <input
              id="video-id"
              name="videoId"
              value={videoId}
              onChange={(event) =>
                setDraftVideoId(event.target.value)
              }
              placeholder="00000000-0000-0000-0000-000000000000"
              spellCheck={false}
              autoComplete="off"
              className="mt-2 h-12 w-full rounded-2xl border border-input bg-background px-4 font-mono text-sm tracking-tight shadow-sm outline-none transition-[border-color,box-shadow] placeholder:text-muted-foreground/55 focus:border-primary/60 focus:ring-3 focus:ring-primary/12"
            />
            <p className="mt-2 text-xs leading-5 text-muted-foreground">
              Trexton will listen through the recording, preserve context,
              and return up to three considered cuts.
            </p>

            {error ? (
              <div
                role="alert"
                className="mt-5 flex items-start gap-2.5 rounded-2xl bg-destructive/8 px-4 py-3 text-sm text-destructive"
              >
                <TriangleAlert
                  aria-hidden="true"
                  className="mt-0.5 size-4 shrink-0"
                />
                {error}
              </div>
            ) : null}

            <Button
              type="submit"
              size="lg"
              disabled={isActive || !videoId.trim()}
              className="mt-6 h-11 rounded-full px-5"
            >
              {isActive ? (
                <LoaderCircle
                  data-icon="inline-start"
                  aria-hidden="true"
                  className="animate-spin motion-reduce:animate-none"
                />
              ) : (
                <Clapperboard
                  data-icon="inline-start"
                  aria-hidden="true"
                />
              )}
              {isActive ? "In progress…" : "Start the cut"}
            </Button>
          </form>
        </section>

        <section
          aria-live="polite"
          className="relative overflow-hidden rounded-3xl border border-border bg-[linear-gradient(145deg,var(--card),color-mix(in_oklch,var(--card),var(--primary)_4%))] p-5 sm:p-7"
        >
          {isActive ? (
            <motion.div
              aria-hidden="true"
              className="absolute inset-x-0 top-0 h-0.5 bg-primary"
              initial={shouldReduceMotion ? false : { x: "-100%" }}
              animate={shouldReduceMotion ? undefined : { x: "100%" }}
              transition={{
                duration: 1.8,
                repeat: Infinity,
                ease: "easeInOut",
              }}
            />
          ) : null}

          <div className="flex items-center justify-between gap-3">
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-muted-foreground">
              Current activity
            </p>
            {job ? <StatusPill status={job.status} /> : null}
          </div>

          {!activeJobId && !job ? (
            <div className="mt-14">
              <CircleDashed
                aria-hidden="true"
                className="size-8 text-muted-foreground/60"
              />
              <h2 className="mt-5 text-lg font-semibold tracking-tight">
                Nothing in motion
              </h2>
              <p className="mt-2 max-w-sm text-sm leading-6 text-muted-foreground">
                Start when the recording is ready. This space will keep
                the thread while Trexton works.
              </p>
            </div>
          ) : job?.status === "completed" ? (
            <div className="mt-14">
              <CheckCircle2
                aria-hidden="true"
                className="size-8 text-success"
              />
              <h2 className="mt-5 text-lg font-semibold tracking-tight">
                The cuts are ready
              </h2>
              <p className="mt-2 text-sm leading-6 text-muted-foreground">
                The recording has been reviewed and its finished cuts are
                waiting in Clips.
              </p>
              <Link
                href="/library"
                className="mt-6 inline-flex h-10 items-center gap-2 rounded-full border border-border bg-background px-4 text-sm font-medium shadow-sm transition-transform hover:-translate-y-0.5 focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-ring/30 motion-reduce:transform-none"
              >
                Review the cuts
                <ArrowRight
                  aria-hidden="true"
                  className="size-4"
                />
              </Link>
            </div>
          ) : job?.status === "failed" ? (
            <div className="mt-14">
              <TriangleAlert
                aria-hidden="true"
                className="size-8 text-destructive"
              />
              <h2 className="mt-5 text-lg font-semibold tracking-tight">
                Processing did not finish
              </h2>
              <p className="mt-2 text-sm leading-6 text-muted-foreground">
                {job.errorMessage ??
                  "Check that the worker and local services are running, then try again."}
              </p>
            </div>
          ) : (
            <div className="mt-14">
              <LoaderCircle
                aria-hidden="true"
                className="size-8 animate-spin text-primary motion-reduce:animate-none"
              />
              <h2 className="mt-5 text-lg font-semibold tracking-tight">
                {job?.status === "processing"
                  ? "Listening for what holds up"
                  : "Queued and ready"}
              </h2>
              <p className="mt-2 text-sm leading-6 text-muted-foreground">
                The long listen happens in the background. You can leave
                this page and return without losing the thread.
              </p>
            </div>
          )}

          {activeJobId ? (
            <p className="mt-10 border-t border-border/70 pt-4 font-mono text-[0.68rem] text-muted-foreground">
              Job {truncateIdentifier(activeJobId)}
            </p>
          ) : null}
        </section>
      </div>
    </div>
  );
}

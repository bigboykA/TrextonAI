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
import { Button } from "@/components/ui/button";
import { LoaderOne } from "@/components/ui/loader";
import { PageHeader } from "@/components/ui/page-header";
import { StatusPill } from "@/components/ui/status-pill";
import { useWorkspace } from "@/components/providers/workspace-provider";
import type { ProcessingJob } from "@/lib/frontend-types";

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export function ProcessingView() {
  const {
    activeVideoId,
    activeJobId,
    setActiveJobId,
  } = useWorkspace();
  const [job, setJob] = useState<ProcessingJob | null>(null);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [statusError, setStatusError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const sourceReady = UUID_PATTERN.test(activeVideoId);

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
      setStatusError(null);
    } catch (loadError) {
      setStatusError(
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

    if (!sourceReady) {
      setSubmitError(
        "Choose a valid local source in Settings before processing."
      );
      return;
    }

    setIsSubmitting(true);
    setSubmitError(null);
    setStatusError(null);
    setJob(null);

    try {
      const response = await fetch("/api/jobs", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ videoId: activeVideoId }),
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

      setActiveJobId(result.jobId);
      setJob({
        id: result.jobId,
        videoId: activeVideoId,
        status: "pending",
        errorMessage: null,
        createdAt: new Date().toISOString(),
        completedAt: null,
      });
    } catch (submitError) {
      setSubmitError(
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
    <div className="space-y-6">
      <PageHeader
        eyebrow="Activity"
        title="Processing"
        description="Start a run and follow its current state."
      />

      <div className="grid gap-4 lg:grid-cols-[minmax(0,1.15fr)_minmax(20rem,0.85fr)]">
        <section className="rounded-xl border border-border bg-card p-5">
          <div className="flex items-start gap-4">
            <div className="grid size-9 shrink-0 place-items-center rounded-lg bg-primary/10 text-primary">
              <Clapperboard
                aria-hidden="true"
                className="size-5"
              />
            </div>
            <div>
              <h2 className="text-sm font-semibold tracking-tight">
                Source recording
              </h2>
              <p className="mt-1 text-sm leading-6 text-muted-foreground">
                Use the recording connected to this local workspace.
              </p>
            </div>
          </div>

          <form
            onSubmit={handleSubmit}
            aria-describedby={
              submitError
                ? "processing-help processing-error"
                : "processing-help"
            }
            className="mt-6"
          >
            <div className="flex items-center justify-between gap-4 border-y border-border py-4">
              <div>
                <p className="text-xs text-muted-foreground">
                  Selected source
                </p>
                <p className="mt-1 text-sm font-medium">
                  {sourceReady
                    ? "Recording ready"
                    : "No recording selected"}
                </p>
              </div>
              <Link
                href="/settings"
                className="inline-flex h-11 items-center rounded-lg px-3 text-xs font-medium text-muted-foreground transition-colors duration-[var(--motion-feedback)] hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-ring/30 sm:h-8"
              >
                {sourceReady ? "Change source" : "Choose source"}
              </Link>
            </div>
            <p
              id="processing-help"
              className="mt-3 text-xs leading-5 text-muted-foreground"
            >
              Trexton will listen through the recording, preserve context,
              and return up to three considered cuts.
            </p>

            {submitError ? (
              <div
                id="processing-error"
                role="alert"
                className="mt-5 flex items-start gap-2.5 rounded-2xl bg-destructive/8 px-4 py-3 text-sm text-destructive"
              >
                <TriangleAlert
                  aria-hidden="true"
                  className="mt-0.5 size-4 shrink-0"
                />
                {submitError}
              </div>
            ) : null}

            <Button
              type="submit"
              size="lg"
              disabled={isActive || !sourceReady}
              className="mt-5 h-11 rounded-lg px-4 sm:h-9"
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
          aria-busy={isActive}
          className="relative overflow-hidden rounded-xl border border-border bg-card p-5"
        >
          <div className="flex items-center justify-between gap-3">
            <p className="text-xs font-medium text-muted-foreground">
              Current activity
            </p>
            {job ? <StatusPill status={job.status} /> : null}
          </div>

          {!activeJobId && !job ? (
            <div className="mt-10">
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
          ) : statusError ? (
            <div className="mt-10">
              <TriangleAlert
                aria-hidden="true"
                className="size-8 text-destructive"
              />
              <h2 className="mt-5 text-lg font-semibold tracking-tight">
                Status unavailable
              </h2>
              <p className="mt-2 text-sm leading-6 text-muted-foreground">
                {statusError}
              </p>
            </div>
          ) : job?.status === "completed" ? (
            <div className="mt-10">
              <CheckCircle2
                aria-hidden="true"
                className="size-8 text-success"
              />
              <h2 className="mt-5 text-lg font-semibold tracking-tight">
                The cuts are ready
              </h2>
              <p className="mt-2 text-sm leading-6 text-muted-foreground">
                The recording has been reviewed and its finished cuts are
                waiting in the Library.
              </p>
              <Link
                href="/library"
                className="mt-6 inline-flex h-11 items-center gap-2 rounded-full border border-border bg-background px-4 text-sm font-medium shadow-sm transition-transform duration-[var(--motion-feedback)] hover:-translate-y-0.5 focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-ring/30 motion-reduce:transform-none sm:h-10"
              >
                Review the cuts
                <ArrowRight
                  aria-hidden="true"
                  className="size-4"
                />
              </Link>
            </div>
          ) : job?.status === "failed" ? (
            <div className="mt-10">
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
            <div className="mt-10">
              <div className="h-8 text-primary">
                <LoaderOne />
              </div>
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

        </section>
      </div>
    </div>
  );
}

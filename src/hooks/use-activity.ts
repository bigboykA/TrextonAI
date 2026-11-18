"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type {
  JobActivity,
  UploadActivity,
} from "@/lib/frontend-types";

const REFRESH_EVENT = "trexton:data-changed";
const POLL_EVENT = "trexton:activity-poll";

export function useActivity() {
  const [uploads, setUploads] = useState<UploadActivity[]>([]);
  const [jobs, setJobs] = useState<JobActivity[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const controllerRef = useRef<AbortController | null>(null);

  const refresh = useCallback(async () => {
    controllerRef.current?.abort();
    const controller = new AbortController();
    controllerRef.current = controller;

    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    }

    try {
      const response = await fetch("/api/activity", {
        cache: "no-store",
        signal: controller.signal,
      });
      const payload = (await response.json()) as {
        uploads?: UploadActivity[];
        jobs?: JobActivity[];
        error?: string;
      };

      if (!response.ok) {
        throw new Error(payload.error ?? "Could not load activity");
      }

      const nextUploads = payload.uploads ?? [];
      const nextJobs = payload.jobs ?? [];
      setUploads(nextUploads);
      setJobs(nextJobs);
      setError(null);

      const hasActiveUpload = nextUploads.some((upload) =>
        ["initiated", "uploading", "completing"].includes(upload.status)
      );
      const hasActiveJob = nextJobs.some((job) =>
        [
          "awaiting_publication",
          "queued",
          "pending",
          "processing",
        ].includes(job.submissionStatus ?? job.status)
      );

      if (hasActiveUpload || hasActiveJob) {
        timeoutRef.current = setTimeout(
          () => window.dispatchEvent(new Event(POLL_EVENT)),
          3_000
        );
      }
    } catch (requestError) {
      if (requestError instanceof DOMException && requestError.name === "AbortError") {
        return;
      }
      setError(
        requestError instanceof Error
          ? requestError.message
          : "Could not load activity"
      );
    } finally {
      if (!controller.signal.aborted) {
        setIsLoading(false);
      }
    }
  }, []);

  useEffect(() => {
    const initialRefresh = window.setTimeout(
      () => void refresh(),
      0
    );

    const handleRefresh = () => void refresh();
    window.addEventListener(REFRESH_EVENT, handleRefresh);
    window.addEventListener(POLL_EVENT, handleRefresh);
    window.addEventListener("focus", handleRefresh);

    return () => {
      window.clearTimeout(initialRefresh);
      controllerRef.current?.abort();
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
      window.removeEventListener(REFRESH_EVENT, handleRefresh);
      window.removeEventListener(POLL_EVENT, handleRefresh);
      window.removeEventListener("focus", handleRefresh);
    };
  }, [refresh]);

  return { uploads, jobs, isLoading, error, refresh };
}

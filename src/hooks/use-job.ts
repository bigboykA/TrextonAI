"use client";

import { useCallback, useEffect, useState } from "react";
import type { ProcessingJob } from "@/lib/frontend-types";

export function useJob(jobId: string) {
  const [job, setJob] = useState<ProcessingJob | null>(null);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    if (!jobId) {
      setJob(null);
      return;
    }

    try {
      const response = await fetch(`/api/jobs/${jobId}`, {
        cache: "no-store",
      });
      if (!response.ok) {
        throw new Error("Could not load activity");
      }
      setJob((await response.json()) as ProcessingJob);
      setError(null);
    } catch (loadError) {
      setError(
        loadError instanceof Error
          ? loadError.message
          : "Could not load activity"
      );
    }
  }, [jobId]);

  useEffect(() => {
    const initialCheck = window.setTimeout(refresh, 0);
    return () => window.clearTimeout(initialCheck);
  }, [refresh]);

  useEffect(() => {
    if (!jobId || !job || !["pending", "processing"].includes(job.status)) {
      return;
    }

    const interval = window.setInterval(refresh, 2500);
    return () => window.clearInterval(interval);
  }, [job, jobId, refresh]);

  return { job, error, refresh };
}

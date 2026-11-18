"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { RecordingSummary } from "@/lib/frontend-types";

const REFRESH_EVENT = "trexton:data-changed";
const POLL_EVENT = "trexton:recordings-poll";

export function notifyTrextonDataChanged() {
  if (typeof window !== "undefined") {
    window.dispatchEvent(new Event(REFRESH_EVENT));
  }
}

export function useRecordings() {
  const [recordings, setRecordings] = useState<RecordingSummary[]>([]);
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
      const response = await fetch("/api/videos", {
        cache: "no-store",
        signal: controller.signal,
      });
      const payload = (await response.json()) as {
        recordings?: RecordingSummary[];
        error?: string;
      };

      if (!response.ok) {
        throw new Error(payload.error ?? "Could not load recordings");
      }

      const nextRecordings = payload.recordings ?? [];
      setRecordings(nextRecordings);
      setError(null);

      const hasActiveJob = nextRecordings.some((recording) => {
        const status =
          recording.latestJob?.submissionStatus ??
          recording.latestJob?.status;
        return (
          status === "awaiting_publication" ||
          status === "queued" ||
          status === "pending" ||
          status === "processing"
        );
      });

      if (hasActiveJob) {
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
          : "Could not load recordings"
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

  return { recordings, isLoading, error, refresh };
}

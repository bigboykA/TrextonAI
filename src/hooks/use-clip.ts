"use client";

import { useEffect, useState } from "react";
import type { GeneratedClip } from "@/lib/frontend-types";

export function useClip(clipId: string) {
  const [clip, setClip] = useState<GeneratedClip | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const controller = new AbortController();

    async function load() {
      setIsLoading(true);
      try {
        const response = await fetch(`/api/clips/${clipId}`, {
          cache: "no-store",
          signal: controller.signal,
        });
        const payload = (await response.json()) as {
          clip?: GeneratedClip;
          error?: string;
        };

        if (!response.ok || !payload.clip) {
          throw new Error(payload.error ?? "Clip could not be loaded");
        }

        setClip(payload.clip);
        setError(null);
      } catch (requestError) {
        if (
          requestError instanceof DOMException &&
          requestError.name === "AbortError"
        ) {
          return;
        }
        setError(
          requestError instanceof Error
            ? requestError.message
            : "Clip could not be loaded"
        );
      } finally {
        if (!controller.signal.aborted) setIsLoading(false);
      }
    }

    void load();
    return () => controller.abort();
  }, [clipId]);

  return { clip, isLoading, error };
}

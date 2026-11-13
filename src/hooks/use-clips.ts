"use client";

import { useCallback, useEffect, useState } from "react";
import type {
  ClipsResponse,
  GeneratedClip,
} from "@/lib/frontend-types";

type ClipsState = {
  clips: GeneratedClip[];
  isLoading: boolean;
  error: string | null;
};

export function useClips(videoId: string) {
  const [state, setState] = useState<ClipsState>({
    clips: [],
    isLoading: false,
    error: null,
  });
  const [requestVersion, setRequestVersion] = useState(0);

  const refresh = useCallback(() => {
    setRequestVersion((version) => version + 1);
  }, []);

  useEffect(() => {
    if (!videoId) {
      return;
    }

    const controller = new AbortController();

    async function loadClips() {
      setState((current) => ({
        ...current,
        isLoading: true,
        error: null,
      }));

      try {
        const response = await fetch(
          `/api/videos/${videoId}/clips`,
          {
            signal: controller.signal,
            cache: "no-store",
          }
        );

        if (!response.ok) {
          const result = (await response.json().catch(() => null)) as
            | { error?: string }
            | null;

          throw new Error(
            result?.error ?? "Could not load your highlights"
          );
        }

        const result = (await response.json()) as ClipsResponse;

        setState({
          clips: result.clips,
          isLoading: false,
          error: null,
        });
      } catch (error) {
        if (controller.signal.aborted) {
          return;
        }

        setState({
          clips: [],
          isLoading: false,
          error:
            error instanceof Error
              ? error.message
              : "Could not load your highlights",
        });
      }
    }

    loadClips();

    return () => controller.abort();
  }, [requestVersion, videoId]);

  return {
    clips: videoId ? state.clips : [],
    isLoading: videoId ? state.isLoading : false,
    error: videoId ? state.error : null,
    refresh,
  };
}

"use client";

import { useState } from "react";

type ClipPlayerProps = {
  src: string;
  title: string;
};

export function ClipPlayer({ src, title }: ClipPlayerProps) {
  const [refreshKey, setRefreshKey] = useState(0);
  const [automaticRetryUsed, setAutomaticRetryUsed] =
    useState(false);
  const [playbackFailed, setPlaybackFailed] = useState(false);

  const playbackSrc = refreshKey
    ? `${src}${src.includes("?") ? "&" : "?"}refresh=${refreshKey}`
    : src;

  return (
    <section
      aria-label="Clip player"
      className="relative overflow-hidden rounded-xl border border-border bg-black"
    >
      <video
        key={playbackSrc}
        className="aspect-video size-full bg-black object-contain"
        src={playbackSrc}
        controls
        playsInline
        preload="metadata"
        aria-label={title}
        onLoadedData={() => setPlaybackFailed(false)}
        onError={() => {
          if (!automaticRetryUsed) {
            setAutomaticRetryUsed(true);
            setRefreshKey(Date.now());
            return;
          }
          setPlaybackFailed(true);
        }}
      />
      {playbackFailed ? (
        <div className="absolute inset-0 grid place-items-center bg-black/75 p-6 text-center text-white">
          <div>
            <p className="text-sm font-medium">
              Playback link expired or is unavailable.
            </p>
            <button
              type="button"
              onClick={() => {
                setPlaybackFailed(false);
                setRefreshKey(Date.now());
              }}
              className="mt-3 h-10 rounded-lg border border-white/20 px-4 text-xs font-medium hover:bg-white/10 focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-white/40"
            >
              Request a fresh link
            </button>
          </div>
        </div>
      ) : null}
    </section>
  );
}

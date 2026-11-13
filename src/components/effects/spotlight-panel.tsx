"use client";

import type {
  CSSProperties,
  PointerEvent,
  ReactNode,
} from "react";
import { useRef } from "react";
import { cn } from "@/lib/utils";

type SpotlightStyle = CSSProperties & {
  "--spotlight-x": string;
  "--spotlight-y": string;
};

export function SpotlightPanel({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  const panelRef = useRef<HTMLDivElement>(null);

  function handlePointerMove(
    event: PointerEvent<HTMLDivElement>
  ) {
    const panel = panelRef.current;

    if (!panel) {
      return;
    }

    const bounds = panel.getBoundingClientRect();
    panel.style.setProperty(
      "--spotlight-x",
      `${event.clientX - bounds.left}px`
    );
    panel.style.setProperty(
      "--spotlight-y",
      `${event.clientY - bounds.top}px`
    );
  }

  const style: SpotlightStyle = {
    "--spotlight-x": "70%",
    "--spotlight-y": "20%",
  };

  return (
    <div
      ref={panelRef}
      onPointerMove={handlePointerMove}
      style={style}
      className={cn(
        "group/spotlight relative isolate overflow-hidden",
        className
      )}
    >
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 -z-10 opacity-70 transition-opacity duration-500 [background:radial-gradient(420px_circle_at_var(--spotlight-x)_var(--spotlight-y),color-mix(in_oklch,var(--primary),transparent_86%),transparent_70%)] group-hover/spotlight:opacity-100 motion-reduce:transition-none"
      />
      {children}
    </div>
  );
}

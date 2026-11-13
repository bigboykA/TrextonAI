"use client";

import Link from "next/link";
import {
  ArrowRight,
  Clapperboard,
  FileAudio,
  Film,
  Scissors,
} from "lucide-react";
import { motion, useReducedMotion } from "motion/react";
import { BrandMark } from "@/components/brand/brand-mark";
import { ClipsPanel } from "@/components/clips/clips-panel";
import { SpotlightPanel } from "@/components/effects/spotlight-panel";
import { useWorkspace } from "@/components/providers/workspace-provider";
import { truncateIdentifier } from "@/lib/format";

const stages = [
  {
    icon: FileAudio,
    title: "Hear the whole story",
    description: "Trexton maps the conversation and its timing.",
  },
  {
    icon: Clapperboard,
    title: "Notice what matters",
    description: "Promising moments keep their setup and reaction.",
  },
  {
    icon: Scissors,
    title: "Make the cut",
    description: "A short, ranked set of clips arrives for review.",
  },
];

export function WorkspaceView() {
  const { activeVideoId } = useWorkspace();
  const shouldReduceMotion = useReducedMotion();

  return (
    <div className="space-y-14">
      <SpotlightPanel className="rounded-[2.25rem] border border-border/75 bg-card/82 px-6 py-8 shadow-[0_26px_80px_color-mix(in_oklch,var(--foreground),transparent_96%)] backdrop-blur-sm sm:px-9 sm:py-10 lg:px-12 lg:py-12">
        <BrandMark
          className="pointer-events-none absolute -right-16 -top-20 -z-10 size-80 rotate-6 text-primary/[0.035] dark:text-primary/[0.025]"
        />
        <div className="relative grid gap-10 lg:grid-cols-[minmax(0,1.2fr)_minmax(20rem,0.8fr)] lg:items-end">
          <div>
            <div className="inline-flex items-center gap-2 rounded-full border border-primary/20 bg-primary/[0.055] px-3 py-1.5 text-xs font-medium text-primary">
              <span
                aria-hidden="true"
                className="size-1.5 rotate-45 rounded-[2px] bg-primary"
              />
              The cut room
            </div>
            <h1 className="mt-7 max-w-3xl text-[clamp(2.4rem,6vw,5rem)] font-semibold leading-[0.96] tracking-[-0.06em] text-balance">
              Keep the moment.
              <span className="text-primary"> Leave the hours.</span>
            </h1>
            <p className="mt-6 max-w-2xl text-base leading-7 text-muted-foreground sm:text-lg sm:leading-8">
              A long recording goes in. A short, considered set of
              clips comes back—timed, ranked, and ready for your eye.
            </p>
            <div className="mt-8 flex flex-wrap items-center gap-3">
              <Link
                href="/processing"
                className="inline-flex h-11 items-center gap-2 rounded-full bg-primary px-5 text-sm font-semibold text-primary-foreground shadow-[0_8px_22px_color-mix(in_oklch,var(--primary),transparent_76%)] transition-transform hover:-translate-y-0.5 focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-ring/30 motion-reduce:transform-none"
              >
                Find highlights
                <ArrowRight
                  aria-hidden="true"
                  className="size-4"
                />
              </Link>
              <Link
                href="/library"
                className="inline-flex h-11 items-center rounded-full border border-border bg-background px-5 text-sm font-medium shadow-sm transition-colors hover:border-foreground/20 focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-ring/30"
              >
                Open clips
              </Link>
            </div>
          </div>

          <motion.div
            initial={
              shouldReduceMotion
                ? false
                : { opacity: 0, y: 12 }
            }
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.08, duration: 0.35 }}
            className="rounded-3xl border border-border/75 bg-background/68 p-5 shadow-[0_14px_40px_color-mix(in_oklch,var(--foreground),transparent_96%)] backdrop-blur-md"
          >
            <div className="flex items-center gap-3">
              <div className="grid size-10 place-items-center rounded-2xl bg-primary/10 text-primary">
                <Film aria-hidden="true" className="size-4.5" />
              </div>
              <div>
                <p className="text-sm font-semibold">
                  {activeVideoId
                    ? "Video source connected"
                    : "No video source selected"}
                </p>
                <p className="mt-0.5 text-xs text-muted-foreground">
                  {activeVideoId
                    ? truncateIdentifier(activeVideoId)
                    : "Connect an existing record to begin"}
                </p>
              </div>
            </div>

            <div className="mt-5 space-y-3 border-t border-border/70 pt-5">
              {stages.map((stage) => {
                const Icon = stage.icon;

                return (
                  <div
                    key={stage.title}
                    className="flex gap-3 rounded-2xl p-2"
                  >
                    <Icon
                      aria-hidden="true"
                      strokeWidth={1.7}
                      className="mt-0.5 size-4 shrink-0 text-muted-foreground"
                    />
                    <div>
                      <p className="text-xs font-semibold">
                        {stage.title}
                      </p>
                      <p className="mt-0.5 text-xs leading-5 text-muted-foreground">
                        {stage.description}
                      </p>
                    </div>
                  </div>
                );
              })}
            </div>
          </motion.div>
        </div>
      </SpotlightPanel>

      <ClipsPanel limit={3} />
    </div>
  );
}

"use client";

import { motion, useReducedMotion } from "motion/react";
import { useState } from "react";
import type { GeneratedClip } from "@/lib/frontend-types";
import { ClipCard } from "./clip-card";

export function ClipGrid({
  clips,
}: {
  clips: GeneratedClip[];
}) {
  const [focusedIndex, setFocusedIndex] = useState<number | null>(
    null
  );
  const shouldReduceMotion = useReducedMotion();

  return (
    <div
      className="grid gap-5 md:grid-cols-2 xl:grid-cols-3"
      onMouseLeave={() => setFocusedIndex(null)}
    >
      {clips.map((clip, index) => {
        const isReceding =
          focusedIndex !== null && focusedIndex !== index;

        return (
          <motion.div
            key={clip.id}
            animate={
              shouldReduceMotion
                ? undefined
                : {
                    opacity: isReceding ? 0.62 : 1,
                    scale: isReceding ? 0.985 : 1,
                    y:
                      focusedIndex === index
                        ? -4
                        : 0,
                  }
            }
            transition={{ duration: 0.18, ease: "easeOut" }}
            onMouseEnter={() => setFocusedIndex(index)}
            onFocus={() => setFocusedIndex(index)}
            onBlur={(event) => {
              if (
                !event.currentTarget.contains(
                  event.relatedTarget as Node | null
                )
              ) {
                setFocusedIndex(null);
              }
            }}
          >
            <ClipCard clip={clip} />
          </motion.div>
        );
      })}
    </div>
  );
}

"use client";

import { motion, useReducedMotion } from "motion/react";

export function AmbientBackground() {
  const shouldReduceMotion = useReducedMotion();

  return (
    <div
      aria-hidden="true"
      className="pointer-events-none fixed inset-0 z-0 overflow-hidden"
    >
      <motion.div
        className="absolute -right-40 -top-56 size-[34rem] rounded-full bg-primary/[0.055] blur-[110px] dark:bg-primary/[0.045]"
        animate={
          shouldReduceMotion
            ? undefined
            : {
                x: [0, -24, 0],
                y: [0, 18, 0],
                scale: [1, 1.04, 1],
              }
        }
        transition={{
          duration: 18,
          repeat: Infinity,
          ease: "easeInOut",
        }}
      />
      <motion.div
        className="absolute -bottom-72 left-[20%] size-[30rem] rounded-full bg-accent/45 blur-[130px] dark:bg-accent/15"
        animate={
          shouldReduceMotion
            ? undefined
            : {
                x: [0, 34, 0],
                y: [0, -18, 0],
              }
        }
        transition={{
          duration: 22,
          repeat: Infinity,
          ease: "easeInOut",
        }}
      />
      <div className="absolute inset-0 bg-[linear-gradient(to_right,color-mix(in_oklch,var(--foreground),transparent_97%)_1px,transparent_1px),linear-gradient(to_bottom,color-mix(in_oklch,var(--foreground),transparent_97%)_1px,transparent_1px)] bg-[size:48px_48px] [mask-image:linear-gradient(to_bottom,black,transparent_60%)] opacity-30 dark:opacity-15" />
    </div>
  );
}

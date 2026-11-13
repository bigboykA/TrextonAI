"use client";

import { motion, useReducedMotion } from "motion/react";
import { useState } from "react";
import {
  motionTransitions,
  reducedMotionTransition,
} from "@/lib/motion";
import { cn } from "@/lib/utils";

type FocusCardsProps = {
  items: Array<{ id: string; content: React.ReactNode }>;
  className?: string;
};

export function FocusCards({ items, className }: FocusCardsProps) {
  const [hovered, setHovered] = useState<number | null>(null);
  const shouldReduceMotion = useReducedMotion();

  return (
    <div
      className={cn("grid gap-4 md:grid-cols-2 xl:grid-cols-3", className)}
      onMouseLeave={() => setHovered(null)}
    >
      {items.map((item, index) => (
        <motion.div
          key={item.id}
          layout
          transition={
            shouldReduceMotion
              ? reducedMotionTransition
              : motionTransitions.layout
          }
          onMouseEnter={() => setHovered(index)}
          onFocusCapture={() => setHovered(index)}
          onBlurCapture={(event) => {
            if (!event.currentTarget.contains(event.relatedTarget)) {
              setHovered(null);
            }
          }}
          className={cn(
            "relative min-w-0 transition-[opacity,transform,filter] duration-[var(--motion-view)] ease-out motion-reduce:transition-none",
            hovered !== null &&
              hovered !== index &&
              "scale-[0.99] opacity-55 saturate-[0.8] motion-reduce:scale-100"
          )}
        >
          {item.content}
        </motion.div>
      ))}
    </div>
  );
}

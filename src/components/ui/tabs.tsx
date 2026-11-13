"use client";

import { motion, useReducedMotion } from "motion/react";
import { useId, useRef } from "react";
import type { KeyboardEvent } from "react";
import {
  motionTransitions,
  reducedMotionTransition,
} from "@/lib/motion";
import { cn } from "@/lib/utils";

export type AnimatedTab = {
  title: string;
  value: string;
};

export const Tabs = ({
  tabs,
  value,
  onValueChange,
  containerClassName,
  activeTabClassName,
  tabClassName,
  ariaLabel = "Filters",
  idBase,
  panelId,
}: {
  tabs: AnimatedTab[];
  value: string;
  onValueChange: (value: string) => void;
  containerClassName?: string;
  activeTabClassName?: string;
  tabClassName?: string;
  ariaLabel?: string;
  idBase?: string;
  panelId?: string;
}) => {
  const generatedId = useId();
  const resolvedIdBase = idBase ?? `tabs-${generatedId.replaceAll(":", "")}`;
  const tabRefs = useRef<Array<HTMLButtonElement | null>>([]);
  const shouldReduceMotion = useReducedMotion();

  function handleKeyDown(
    event: KeyboardEvent<HTMLButtonElement>,
    index: number
  ) {
    let nextIndex: number | null = null;

    if (event.key === "ArrowRight") {
      nextIndex = (index + 1) % tabs.length;
    } else if (event.key === "ArrowLeft") {
      nextIndex = (index - 1 + tabs.length) % tabs.length;
    } else if (event.key === "Home") {
      nextIndex = 0;
    } else if (event.key === "End") {
      nextIndex = tabs.length - 1;
    }

    if (nextIndex === null) return;

    event.preventDefault();
    onValueChange(tabs[nextIndex].value);
    tabRefs.current[nextIndex]?.focus();
  }

  return (
    <div
      role="tablist"
      aria-label={ariaLabel}
      className={cn(
        "relative flex max-w-full items-center gap-0.5 overflow-x-auto rounded-lg bg-muted/70 p-0.5",
        containerClassName
      )}
    >
      {tabs.map((tab, index) => (
        <button
          key={tab.value}
          ref={(node) => {
            tabRefs.current[index] = node;
          }}
          id={`${resolvedIdBase}-${tab.value}`}
          type="button"
          role="tab"
          aria-selected={value === tab.value}
          aria-controls={panelId}
          tabIndex={value === tab.value ? 0 : -1}
          onClick={() => onValueChange(tab.value)}
          onKeyDown={(event) => handleKeyDown(event, index)}
          className={cn(
            "relative h-11 shrink-0 rounded-md px-3 text-xs font-medium text-muted-foreground transition-colors duration-[var(--motion-feedback)] hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/40 sm:h-8",
            value === tab.value && "text-foreground",
            tabClassName
          )}
        >
          {value === tab.value ? (
            <motion.span
              layoutId={`${resolvedIdBase}-active`}
              transition={
                shouldReduceMotion
                  ? reducedMotionTransition
                  : motionTransitions.navigation
              }
              className={cn(
                "absolute inset-0 rounded-md border border-border/80 bg-background shadow-sm",
                activeTabClassName
              )}
            />
          ) : null}
          <span className="relative z-10">{tab.title}</span>
        </button>
      ))}
    </div>
  );
};

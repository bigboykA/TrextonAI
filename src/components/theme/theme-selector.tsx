"use client";

import { Laptop, Moon, Sun } from "lucide-react";
import { useTheme } from "next-themes";
import { useSyncExternalStore } from "react";
import { cn } from "@/lib/utils";

const options = [
  {
    value: "light",
    label: "Light",
    description: "Warm and bright",
    icon: Sun,
  },
  {
    value: "dark",
    label: "Dark",
    description: "Calm graphite",
    icon: Moon,
  },
  {
    value: "system",
    label: "System",
    description: "Match this device",
    icon: Laptop,
  },
] as const;

function subscribe() {
  return () => {};
}

export function ThemeSelector() {
  const { theme, setTheme } = useTheme();
  const isHydrated = useSyncExternalStore(
    subscribe,
    () => true,
    () => false
  );

  return (
    <div
      className="grid gap-3 sm:grid-cols-3"
      aria-label="Appearance"
    >
      {options.map((option) => {
        const Icon = option.icon;
        const isSelected =
          isHydrated && theme === option.value;

        return (
          <button
            key={option.value}
            type="button"
            aria-pressed={isSelected}
            onClick={() => setTheme(option.value)}
            className={cn(
              "group flex min-h-28 flex-col items-start rounded-2xl border p-4 text-left transition-all focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-ring/30",
              isSelected
                ? "border-primary/50 bg-primary/6 shadow-[0_1px_0_0_color-mix(in_oklch,var(--primary),transparent_78%)]"
                : "border-border bg-card hover:-translate-y-0.5 hover:border-foreground/20 motion-reduce:transform-none"
            )}
          >
            <Icon
              aria-hidden="true"
              className={cn(
                "mb-auto size-5",
                isSelected
                  ? "text-primary"
                  : "text-muted-foreground"
              )}
            />
            <span className="mt-5 text-sm font-semibold">
              {option.label}
            </span>
            <span className="mt-0.5 text-xs text-muted-foreground">
              {option.description}
            </span>
          </button>
        );
      })}
    </div>
  );
}

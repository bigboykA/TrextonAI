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
      className="grid gap-1 rounded-lg bg-muted/70 p-1 sm:grid-cols-3"
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
              "group flex min-h-14 items-center gap-3 rounded-md px-3 text-left transition-colors duration-[var(--motion-feedback)] focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-ring/30",
              isSelected
                ? "bg-background text-foreground shadow-sm"
                : "text-muted-foreground hover:bg-background/55 hover:text-foreground"
            )}
          >
            <Icon
              aria-hidden="true"
              className={cn(
                "size-4 shrink-0",
                isSelected
                  ? "text-primary"
                  : "text-muted-foreground"
              )}
            />
            <span>
              <span className="block text-xs font-semibold">
                {option.label}
              </span>
              <span className="mt-0.5 block text-[0.7rem] text-muted-foreground">
                {option.description}
              </span>
            </span>
          </button>
        );
      })}
    </div>
  );
}

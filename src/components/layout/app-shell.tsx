"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  CircleDotDashed,
  Clapperboard,
  House,
  Menu,
  Settings,
  X,
} from "lucide-react";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { useState } from "react";
import { BrandWordmark } from "@/components/brand/brand-mark";
import { AmbientBackground } from "@/components/effects/ambient-background";
import { cn } from "@/lib/utils";

const navigation = [
  { href: "/", label: "Home", icon: House },
  { href: "/library", label: "Clips", icon: Clapperboard },
  {
    href: "/processing",
    label: "Activity",
    icon: CircleDotDashed,
  },
  { href: "/settings", label: "Settings", icon: Settings },
] as const;

function Wordmark() {
  return (
    <Link
      href="/"
      className="inline-flex rounded-lg focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-ring/30"
      aria-label="Trexton home"
    >
      <BrandWordmark />
    </Link>
  );
}

function NavigationLink({
  href,
  label,
  icon: Icon,
  pathname,
  onNavigate,
}: (typeof navigation)[number] & {
  pathname: string;
  onNavigate?: () => void;
}) {
  const isActive =
    href === "/" ? pathname === "/" : pathname.startsWith(href);

  return (
    <Link
      href={href}
      onClick={onNavigate}
      aria-current={isActive ? "page" : undefined}
      className={cn(
        "relative flex h-10 items-center gap-3 rounded-xl px-3.5 text-sm font-medium transition-all focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-ring/30",
        isActive
          ? "bg-primary/[0.09] text-primary shadow-[inset_0_0_0_1px_color-mix(in_oklch,var(--primary),transparent_84%)]"
          : "text-muted-foreground hover:translate-x-0.5 hover:bg-muted/75 hover:text-foreground motion-reduce:transform-none"
      )}
    >
      {isActive ? (
        <span
          aria-hidden="true"
          className="absolute left-1.5 size-1.5 rotate-45 rounded-[2px] bg-primary"
        />
      ) : null}
      <Icon
        aria-hidden="true"
        strokeWidth={1.8}
        className="size-[1.05rem]"
      />
      {label}
    </Link>
  );
}

export function AppShell({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const shouldReduceMotion = useReducedMotion();
  const [isMenuOpen, setIsMenuOpen] = useState(false);

  return (
    <div className="min-h-dvh bg-background">
      <AmbientBackground />
      <aside className="fixed inset-y-0 left-0 z-30 hidden w-60 border-r border-sidebar-border bg-sidebar/95 px-4 py-5 backdrop-blur-xl md:flex md:flex-col">
        <div className="px-2">
          <Wordmark />
          <p className="mt-2 pl-[2.65rem] text-[0.68rem] tracking-wide text-muted-foreground">
            Clips, considered.
          </p>
        </div>

        <nav
          aria-label="Primary navigation"
          className="mt-9 space-y-1"
        >
          {navigation.map((item) => (
            <NavigationLink
              key={item.href}
              {...item}
              pathname={pathname}
            />
          ))}
        </nav>

        <div className="mt-auto rounded-2xl border border-border/70 bg-background/50 p-3.5">
          <div className="mb-2 flex items-center gap-2">
            <span
              aria-hidden="true"
              className="size-1.5 rounded-full bg-success shadow-[0_0_0_3px_color-mix(in_oklch,var(--success),transparent_85%)]"
            />
            <p className="text-xs font-medium">Local workspace</p>
          </div>
          <p className="mt-1 text-xs leading-5 text-muted-foreground">
            Private preview. Authentication is not connected yet.
          </p>
        </div>
      </aside>

      <header className="sticky top-0 z-40 flex h-16 items-center justify-between border-b border-border/70 bg-background/85 px-5 backdrop-blur-xl md:hidden">
        <Wordmark />
        <button
          type="button"
          onClick={() => setIsMenuOpen((open) => !open)}
          aria-expanded={isMenuOpen}
          aria-controls="mobile-navigation"
          aria-label={isMenuOpen ? "Close menu" : "Open menu"}
          className="grid size-9 place-items-center rounded-full border border-border bg-card text-foreground shadow-sm focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-ring/30"
        >
          {isMenuOpen ? (
            <X aria-hidden="true" className="size-4" />
          ) : (
            <Menu aria-hidden="true" className="size-4" />
          )}
        </button>
      </header>

      <AnimatePresence>
        {isMenuOpen ? (
          <motion.div
            id="mobile-navigation"
            initial={
              shouldReduceMotion
                ? false
                : { opacity: 0, y: -8 }
            }
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.16, ease: "easeOut" }}
            className="fixed inset-x-3 top-[4.5rem] z-50 rounded-2xl border border-border bg-popover p-2 shadow-2xl shadow-foreground/10 md:hidden"
          >
            <nav aria-label="Mobile navigation" className="space-y-1">
              {navigation.map((item) => (
                <NavigationLink
                  key={item.href}
                  {...item}
                  pathname={pathname}
                  onNavigate={() => setIsMenuOpen(false)}
                />
              ))}
            </nav>
          </motion.div>
        ) : null}
      </AnimatePresence>

      <main className="relative z-10 md:pl-60">
        <motion.div
          key={pathname}
          initial={
            shouldReduceMotion ? false : { opacity: 0, y: 5 }
          }
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.22, ease: "easeOut" }}
          className="mx-auto min-h-dvh w-full max-w-[92rem] px-5 py-8 sm:px-8 sm:py-10 lg:px-12 lg:py-12"
        >
          {children}
        </motion.div>
      </main>
    </div>
  );
}

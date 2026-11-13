"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  CircleDotDashed,
  Clapperboard,
  House,
  PanelLeftClose,
  PanelLeftOpen,
  Plus,
  Search,
  Settings,
} from "lucide-react";
import { motion, useReducedMotion } from "motion/react";
import { FormEvent, useState } from "react";
import { BrandWordmark } from "@/components/brand/brand-mark";
import { useWorkspace } from "@/components/providers/workspace-provider";
import {
  motionTransitions,
  reducedMotionTransition,
} from "@/lib/motion";
import { cn } from "@/lib/utils";

const navigation = [
  { href: "/", label: "Home", icon: House },
  { href: "/library", label: "Library", icon: Clapperboard },
  {
    href: "/processing",
    label: "Activity",
    icon: CircleDotDashed,
  },
  { href: "/settings", label: "Settings", icon: Settings },
] as const;

function Wordmark({ compact = false }: { compact?: boolean }) {
  return (
    <Link
      href="/"
      className="inline-flex min-h-11 items-center rounded-lg focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-ring/30 md:min-h-8"
      aria-label="Trexton home"
    >
      <BrandWordmark compact={compact} />
    </Link>
  );
}

function NavigationLink({
  href,
  label,
  icon: Icon,
  pathname,
  collapsed = false,
  mobile = false,
  reduceMotion = false,
}: (typeof navigation)[number] & {
  pathname: string;
  collapsed?: boolean;
  mobile?: boolean;
  reduceMotion?: boolean | null;
}) {
  const isActive =
    href === "/" ? pathname === "/" : pathname.startsWith(href);

  return (
    <Link
      href={href}
      aria-current={isActive ? "page" : undefined}
      title={collapsed ? label : undefined}
      className={cn(
        "relative flex items-center text-sm font-medium transition-colors duration-[var(--motion-feedback)] focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-ring/30",
        mobile
          ? "h-13 flex-1 flex-col justify-center gap-1 rounded-lg px-1 text-[0.7rem]"
          : "h-9 gap-3 rounded-lg px-3",
        collapsed && !mobile && "justify-center px-0",
        isActive
          ? "text-primary"
          : "text-muted-foreground hover:bg-muted/70 hover:text-foreground"
      )}
    >
      {isActive ? (
        <motion.span
          layoutId={mobile ? "mobile-nav-active" : "desktop-nav-active"}
          aria-hidden="true"
          className={cn(
            "absolute bg-primary/[0.1]",
            mobile
              ? "inset-x-1 top-1 h-8 rounded-lg"
              : "inset-0 rounded-lg"
          )}
          transition={
            reduceMotion
              ? reducedMotionTransition
              : motionTransitions.navigation
          }
        />
      ) : null}
      <Icon
        aria-hidden="true"
        strokeWidth={1.8}
        className="relative z-10 size-4"
      />
      {!collapsed || mobile ? (
        <span className="relative z-10">{label}</span>
      ) : null}
    </Link>
  );
}

export function AppShell({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const shouldReduceMotion = useReducedMotion();
  const [isCollapsed, setIsCollapsed] = useState(false);
  const { librarySearch, setLibrarySearch } = useWorkspace();

  function handleSearch(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    router.push("/library");
  }

  return (
    <div className="min-h-dvh bg-background">
      <a
        href="#main-content"
        className="pointer-events-none fixed left-4 top-4 z-100 -translate-y-20 rounded-lg bg-background px-3 py-2 text-sm font-medium opacity-0 shadow-lg transition-[transform,opacity] duration-[var(--motion-feedback)] focus:pointer-events-auto focus:translate-y-0 focus:opacity-100 focus:outline-none focus:ring-3 focus:ring-ring/40 motion-reduce:transition-none"
      >
        Skip to content
      </a>

      <motion.aside
        layout
        transition={
          shouldReduceMotion
            ? reducedMotionTransition
            : motionTransitions.layout
        }
        className={cn(
          "fixed inset-y-0 left-0 z-40 hidden border-r border-sidebar-border bg-sidebar px-3 py-4 md:flex md:flex-col",
          isCollapsed ? "w-[72px]" : "w-[212px]"
        )}
      >
        <div
          className={cn(
            "flex h-9 items-center",
            isCollapsed ? "justify-center" : "px-1"
          )}
        >
          <Wordmark compact={isCollapsed} />
        </div>

        <nav
          aria-label="Primary navigation"
          className="mt-7 space-y-1"
        >
          {navigation.map((item) => (
            <NavigationLink
              key={item.href}
              {...item}
              pathname={pathname}
              collapsed={isCollapsed}
              reduceMotion={shouldReduceMotion}
            />
          ))}
        </nav>

        <button
          type="button"
          onClick={() => setIsCollapsed((value) => !value)}
          aria-label={isCollapsed ? "Expand sidebar" : "Collapse sidebar"}
          className={cn(
            "mt-auto flex h-9 items-center gap-3 rounded-lg px-3 text-sm text-muted-foreground transition-colors hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-ring/30",
            isCollapsed && "justify-center px-0"
          )}
        >
          {isCollapsed ? (
            <PanelLeftOpen aria-hidden="true" className="size-4" />
          ) : (
            <>
              <PanelLeftClose aria-hidden="true" className="size-4" />
              <span>Collapse</span>
            </>
          )}
        </button>
      </motion.aside>

      <motion.div
        layout="position"
        transition={
          shouldReduceMotion
            ? reducedMotionTransition
            : motionTransitions.layout
        }
        className={cn(
          "hidden md:block",
          isCollapsed ? "md:ml-[72px]" : "md:ml-[212px]"
        )}
      >
        <header className="sticky top-0 z-30 flex h-14 items-center gap-4 border-b border-border/75 bg-background/90 px-5 backdrop-blur-xl">
          <form
            onSubmit={handleSearch}
            className="relative w-full max-w-md"
          >
            <Search
              aria-hidden="true"
              className="pointer-events-none absolute left-3 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground"
            />
            <input
              value={librarySearch}
              onChange={(event) => setLibrarySearch(event.target.value)}
              aria-label="Search clips"
              placeholder="Search clips"
              className="h-8 w-full rounded-lg border border-transparent bg-muted/70 pl-9 pr-3 text-sm outline-none transition-colors duration-[var(--motion-feedback)] placeholder:text-muted-foreground focus:border-border focus:bg-background focus:ring-3 focus:ring-ring/15"
            />
          </form>
          <div className="ml-auto flex items-center gap-2">
            <Link
              href="/processing"
              className="inline-flex h-8 items-center gap-2 rounded-lg px-3 text-xs font-medium text-muted-foreground transition-colors duration-[var(--motion-feedback)] hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-ring/30"
            >
              <CircleDotDashed aria-hidden="true" className="size-3.5" />
              Activity
            </Link>
            <Link
              href="/processing"
              className="inline-flex h-8 items-center gap-1.5 rounded-lg bg-primary px-3 text-xs font-semibold text-primary-foreground shadow-sm transition-transform duration-[var(--motion-feedback)] hover:scale-[1.02] active:scale-[0.98] focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-ring/30 motion-reduce:transform-none"
            >
              <Plus aria-hidden="true" className="size-3.5" />
              New
            </Link>
          </div>
        </header>
      </motion.div>

      <header className="sticky top-0 z-30 flex h-16 items-center justify-between border-b border-border/75 bg-background/90 px-4 backdrop-blur-xl md:hidden">
        <Wordmark />
        <div className="flex items-center gap-1">
          <Link
            href="/library"
            aria-label="Search clips"
            className="grid size-11 place-items-center rounded-lg text-muted-foreground hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-ring/30"
          >
            <Search aria-hidden="true" className="size-4" />
          </Link>
          <Link
            href="/processing"
            aria-label="Start new activity"
            className="grid size-11 place-items-center rounded-lg bg-primary text-primary-foreground focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-ring/30"
          >
            <Plus aria-hidden="true" className="size-4" />
          </Link>
        </div>
      </header>

      <motion.main
        id="main-content"
        tabIndex={-1}
        layout="position"
        transition={
          shouldReduceMotion
            ? reducedMotionTransition
            : motionTransitions.layout
        }
        className={cn(
          "relative scroll-mt-16 pb-18 outline-none md:pb-0",
          isCollapsed ? "md:ml-[72px]" : "md:ml-[212px]"
        )}
      >
        <div className="mx-auto min-h-[calc(100dvh-3.5rem)] w-full max-w-[96rem] px-4 py-6 sm:px-6 md:px-8 md:py-7">
          {children}
        </div>
      </motion.main>

      <nav
        aria-label="Mobile navigation"
        className="fixed inset-x-0 bottom-0 z-40 flex h-16 border-t border-border bg-background/95 px-2 pb-[env(safe-area-inset-bottom)] backdrop-blur-xl md:hidden"
      >
        {navigation.map((item) => (
          <NavigationLink
            key={item.href}
            {...item}
            pathname={pathname}
            mobile
            reduceMotion={shouldReduceMotion}
          />
        ))}
      </nav>
    </div>
  );
}

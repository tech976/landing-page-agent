import Link from "next/link";
import { Plus, Sparkles } from "lucide-react";

import { buttonStyles } from "@/components/ui/Button";
import { ThemeToggle } from "@/components/ui/ThemeToggle";

/**
 * Landing Agent — product top bar.
 *
 * The persistent app chrome that sits above every dashboard view: brand lockup +
 * one-line tagline on the left, the light/dark control and the primary "New Landing
 * Page" action on the right. Pure app-chrome tokens, so it flips cleanly in dark mode.
 *
 * Server-safe: it only *renders* the `ThemeToggle` client island, it is not one itself.
 */
export function AppTopBar() {
  return (
    <header className="sticky top-0 z-30 border-b border-app-border bg-app-surface/80 backdrop-blur-md">
      <div className="mx-auto flex w-full max-w-[var(--container-page)] items-center gap-3 px-[var(--space-gutter)] py-3">
        {/* Brand lockup — accent mark + wordmark + tagline. */}
        <Link
          href="/"
          className="group flex items-center gap-2.5 rounded-xl outline-none focus-visible:ring-4 focus-visible:ring-app-ring/50"
        >
          <span
            aria-hidden
            className="relative flex size-9 shrink-0 items-center justify-center rounded-xl bg-app-accent text-app-accent-fg shadow-sm transition-transform duration-[var(--dur-fast)] ease-[var(--ease-out-soft)] group-hover:-translate-y-0.5"
          >
            <Sparkles className="size-5" />
            {/* "live" pip — a small product flourish */}
            <span className="absolute -right-0.5 -bottom-0.5 size-2.5 rounded-full bg-app-success ring-2 ring-app-surface" />
          </span>
          <span className="flex min-w-0 flex-col leading-none">
            <span className="font-heading text-base font-extrabold tracking-tight text-app-fg">
              Landing Agent
            </span>
            <span className="mt-1 hidden truncate font-body text-xs text-app-fg-muted sm:block">
              D2C landing pages, generated &amp; edited in minutes
            </span>
          </span>
        </Link>

        <div className="ml-auto flex items-center gap-2 sm:gap-3">
          <ThemeToggle />
          <Link href="/new" className={buttonStyles({ size: "sm" })}>
            <Plus className="size-4" aria-hidden />
            <span className="hidden sm:inline">New Landing Page</span>
            <span className="sm:hidden">New</span>
          </Link>
        </div>
      </div>
    </header>
  );
}

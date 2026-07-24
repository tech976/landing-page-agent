"use client";

/**
 * Landing Agent — app light/dark theme control.
 *
 * The product UI (not generated pages) has three theme states: "light", "dark", and
 * "system" (follow the OS). The choice is stored in localStorage under THEME_KEY and
 * reflected as `data-theme` on <html> — "light"/"dark" pin it, absence means "system".
 *
 * NO FLASH: the source-of-truth for the FIRST paint is the inline script in the root
 * layout (applyThemeScript), which runs before React hydrates. This component only
 * handles user toggling afterward and keeps the <html> attribute + storage in sync.
 */

import { useEffect, useState } from "react";
import { Monitor, Moon, Sun } from "lucide-react";

export type ThemeChoice = "light" | "dark" | "system";
const THEME_KEY = "la-theme";

/**
 * The blocking script string injected into <head>. Sets data-theme before first paint
 * so there is never a light-then-dark flash. Kept tiny and dependency-free — it runs
 * as raw JS, not React.
 */
export const applyThemeScript = `
(function () {
  try {
    var stored = localStorage.getItem('${THEME_KEY}');
    var theme = stored === 'light' || stored === 'dark' ? stored
      : (window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light');
    document.documentElement.setAttribute('data-theme', theme);
  } catch (e) {
    document.documentElement.setAttribute('data-theme', 'light');
  }
})();
`;

function systemPrefersDark(): boolean {
  return typeof window !== "undefined" && window.matchMedia("(prefers-color-scheme: dark)").matches;
}

/** Applies a choice to <html> + storage. "system" clears storage and follows the OS. */
function apply(choice: ThemeChoice) {
  const root = document.documentElement;
  if (choice === "system") {
    localStorage.removeItem(THEME_KEY);
    root.setAttribute("data-theme", systemPrefersDark() ? "dark" : "light");
  } else {
    localStorage.setItem(THEME_KEY, choice);
    root.setAttribute("data-theme", choice);
  }
}

const ORDER: ThemeChoice[] = ["light", "dark", "system"];
const META: Record<ThemeChoice, { icon: typeof Sun; label: string }> = {
  light: { icon: Sun, label: "Light" },
  dark: { icon: Moon, label: "Dark" },
  system: { icon: Monitor, label: "System" },
};

/**
 * A compact segmented control: Light · Dark · System. Reads the current choice from
 * storage on mount (so it matches what the no-flash script already applied), and
 * re-applies the resolved theme when the OS preference changes while on "system".
 */
export function ThemeToggle({ className }: { className?: string }) {
  const [choice, setChoice] = useState<ThemeChoice>("system");
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    const stored = localStorage.getItem(THEME_KEY);
    setChoice(stored === "light" || stored === "dark" ? stored : "system");
    setMounted(true);
  }, []);

  // While on "system", track OS changes live.
  useEffect(() => {
    if (choice !== "system") return;
    const mq = window.matchMedia("(prefers-color-scheme: dark)");
    const onChange = () => apply("system");
    mq.addEventListener("change", onChange);
    return () => mq.removeEventListener("change", onChange);
  }, [choice]);

  const select = (next: ThemeChoice) => {
    setChoice(next);
    apply(next);
  };

  return (
    <div
      role="group"
      aria-label="Theme"
      className={`inline-flex items-center gap-0.5 rounded-lg border border-app-border bg-app-surface-2 p-0.5 ${className ?? ""}`}
    >
      {ORDER.map((c) => {
        const { icon: Icon, label } = META[c];
        const active = mounted && choice === c;
        return (
          <button
            key={c}
            type="button"
            onClick={() => select(c)}
            aria-pressed={active}
            title={label}
            className={`grid size-7 place-items-center rounded-md transition-colors ${
              active
                ? "bg-app-surface text-app-fg shadow-xs"
                : "text-app-fg-muted hover:text-app-fg"
            }`}
          >
            <Icon className="size-4" aria-hidden />
            <span className="sr-only">{label}</span>
          </button>
        );
      })}
    </div>
  );
}

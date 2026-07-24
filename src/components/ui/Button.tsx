import type * as React from "react";
import { Loader2 } from "lucide-react";

import { cn } from "@/lib/utils";

/**
 * App-shell button.
 *
 * DESIGN-SYSTEM §5. Every class is token-driven — no hex, no `bg-[#...]`, no
 * interpolation. Variants resolve through static lookup maps so Tailwind's scanner
 * can see every literal class string.
 *
 * §5.3 is non-negotiable: `sm` (h-11 / 44px) is the floor. No smaller size exists,
 * including in dense internal screens.
 *
 * `buttonStyles()` is exported separately so `next/link` anchors and `<label>`
 * elements can wear the exact same skin without nesting a real <button>.
 */

export type ButtonVariant = "primary" | "secondary" | "ghost" | "danger";
export type ButtonSize = "sm" | "md" | "lg";

const BASE =
  "inline-flex items-center justify-center gap-2 shrink-0 " +
  "font-heading font-bold tracking-tight text-center whitespace-nowrap " +
  "select-none cursor-pointer touch-manipulation " +
  "rounded-[var(--radius-cta)] " +
  "transition-[background-color,box-shadow,transform,border-color,color] " +
  "duration-[var(--dur-fast)] ease-[var(--ease-out-soft)] " +
  "focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-app-ring/60 " +
  "focus-visible:ring-offset-2 focus-visible:ring-offset-app-bg " +
  "disabled:opacity-50 disabled:pointer-events-none disabled:shadow-none " +
  "aria-disabled:opacity-50 aria-disabled:pointer-events-none " +
  "active:duration-[var(--dur-instant)]";

const VARIANT_CLASSES: Record<ButtonVariant, string> = {
  // `shadow-cta`/`shadow-cta-hover` are brand-tinted (re-color on landing-brand swap),
  // so the app primary uses neutral elevation shadows instead — never brand color.
  primary:
    "bg-app-accent text-app-accent-fg shadow-sm " +
    "hover:bg-app-accent-hover hover:shadow-card hover:-translate-y-0.5 " +
    "active:bg-app-accent-hover active:translate-y-0 active:scale-[0.98] active:shadow-sm",
  secondary:
    "bg-app-surface text-app-fg border-2 border-app-border-strong shadow-xs " +
    "hover:bg-app-surface-2 hover:border-app-accent hover:text-app-accent " +
    "active:bg-app-surface-2 active:scale-[0.98]",
  ghost:
    "bg-transparent text-app-fg border-2 border-transparent " +
    "hover:bg-app-surface-2 hover:text-app-fg " +
    "active:bg-app-surface-2 active:scale-[0.98]",
  // `text-app-accent-fg` is the app knockout white (pure white in both themes) used
  // as a foreground on the filled danger swatch. Still a token, never a literal white.
  danger:
    "bg-app-danger text-app-accent-fg shadow-xs " +
    "hover:brightness-95 hover:-translate-y-0.5 " +
    "active:translate-y-0 active:scale-[0.98]",
};

const SIZE_CLASSES: Record<ButtonSize, string> = {
  sm: "h-11 min-h-11 px-4 gap-1.5 text-sm",
  md: "h-12 min-h-12 px-6 gap-2 text-base",
  lg: "h-14 min-h-14 px-8 gap-2.5 text-lg",
};

export interface ButtonStyleOptions {
  variant?: ButtonVariant;
  size?: ButtonSize;
  fullWidth?: boolean;
  className?: string;
}

export function buttonStyles({
  variant = "primary",
  size = "md",
  fullWidth = false,
  className,
}: ButtonStyleOptions = {}): string {
  return cn(
    BASE,
    VARIANT_CLASSES[variant],
    SIZE_CLASSES[size],
    fullWidth && "w-full",
    className,
  );
}

export interface ButtonProps extends React.ComponentPropsWithRef<"button"> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  fullWidth?: boolean;
  /** Swaps the leading icon for a spinner and blocks interaction. */
  loading?: boolean;
  /** Rendered before the label. Ignored while `loading`. */
  icon?: React.ReactNode;
}

export function Button({
  variant = "primary",
  size = "md",
  fullWidth,
  loading = false,
  icon,
  className,
  children,
  disabled,
  type = "button",
  ...props
}: ButtonProps) {
  return (
    <button
      type={type}
      disabled={disabled ?? loading}
      aria-busy={loading || undefined}
      className={buttonStyles({ variant, size, fullWidth, className })}
      {...props}
    >
      {loading ? (
        <Loader2 className="size-4 shrink-0 motion-safe:animate-spin" aria-hidden />
      ) : (
        icon
      )}
      {children}
    </button>
  );
}

/**
 * Square 44×44 icon-only button. DESIGN-SYSTEM §5.3 — icon buttons are `size-11`
 * minimum. `label` is mandatory: an icon with no accessible name is a bug.
 */
export interface IconButtonProps extends Omit<ButtonProps, "children" | "size"> {
  label: string;
  children: React.ReactNode;
}

export function IconButton({
  label,
  variant = "ghost",
  className,
  children,
  ...props
}: IconButtonProps) {
  return (
    <Button
      variant={variant}
      size="sm"
      aria-label={label}
      title={label}
      className={cn("size-11 p-0", className)}
      {...props}
    >
      {children}
    </Button>
  );
}

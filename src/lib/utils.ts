import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

/**
 * Conditional className builder with Tailwind conflict resolution.
 *
 *   cn("px-4 py-2", isActive && "bg-primary", className)
 *
 * NOTE for block authors: `cn` composes classes — it does not launder them. Colour,
 * radius, shadow and font values must still be token utilities (`bg-primary`,
 * `rounded-lg`, `shadow-card`). Never interpolate a token into a class name
 * (`bg-${token}`); Tailwind's scanner cannot see it. Use a static lookup map.
 * See DESIGN-SYSTEM §2.4.
 */
export function cn(...inputs: ClassValue[]): string {
  return twMerge(clsx(inputs));
}

/* ────────────────────────────────────────────────────────────────────────────
   Indian currency formatting
   ──────────────────────────────────────────────────────────────────────────── */

export interface FormatINROptions {
  /** Include the ₹ symbol. Default true. */
  symbol?: boolean;
  /**
   * Treat the input as integer paise rather than rupees. `Money.amount` is always
   * paise, so pass `true` whenever the value came off a `Money` object.
   */
  fromPaise?: boolean;
  /** Force paise digits. Default: shown only when the value is not a whole rupee. */
  decimals?: boolean;
}

/**
 * Formats a number as Indian rupees with Indian digit grouping (lakh/crore):
 *
 *   formatINR(1234)                        → "₹1,234"
 *   formatINR(123456)                      → "₹1,23,456"
 *   formatINR(89900, { fromPaise: true })  → "₹899"
 *   formatINR(89950, { fromPaise: true })  → "₹899.50"
 *   formatINR(123456, { symbol: false })   → "1,23,456"
 *
 * Uses the en-IN locale, so grouping is 3-2-2 (₹1,49,900) exactly as Indian shoppers
 * expect. A page that prints ₹149,900 reads as a foreign store and costs trust.
 */
export function formatINR(value: number, options: FormatINROptions = {}): string {
  const { symbol = true, fromPaise = false, decimals } = options;

  const rupees = fromPaise ? value / 100 : value;
  const safe = Number.isFinite(rupees) ? rupees : 0;
  const showDecimals = decimals ?? !Number.isInteger(safe);

  const formatted = new Intl.NumberFormat("en-IN", {
    style: "decimal",
    minimumFractionDigits: showDecimals ? 2 : 0,
    maximumFractionDigits: showDecimals ? 2 : 0,
  }).format(safe);

  return symbol ? `₹${formatted}` : formatted;
}

/** Convenience wrapper for a `Money` value (always integer paise). */
export function formatMoney(
  money: { amount: number; currency: "INR" },
  options: Omit<FormatINROptions, "fromPaise"> = {},
): string {
  return formatINR(money.amount, { ...options, fromPaise: true });
}

/** Rupees → integer paise. Use when converting a brief price into `Money.amount`. */
export function toPaise(rupees: number): number {
  return Math.round(rupees * 100);
}

/**
 * Discount percentage from a price pair, rounded down so the badge never overstates
 * the saving. Returns 0 when the pair is invalid (compareAt <= price).
 */
export function discountPercent(priceAmount: number, compareAtAmount: number): number {
  if (!compareAtAmount || compareAtAmount <= priceAmount) return 0;
  return Math.floor(((compareAtAmount - priceAmount) / compareAtAmount) * 100);
}

/* ────────────────────────────────────────────────────────────────────────────
   Misc
   ──────────────────────────────────────────────────────────────────────────── */

/** Lowercase kebab-case slug, matching `PageSchema.slug`'s regex. */
export function slugify(input: string): string {
  return input
    .toLowerCase()
    .normalize("NFKD")
    .replace(/\p{Diacritic}/gu, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80)
    .replace(/-+$/g, "");
}

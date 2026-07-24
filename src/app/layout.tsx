import type { Metadata, Viewport } from "next";
import { Inter, Plus_Jakarta_Sans } from "next/font/google";
import type * as React from "react";

import { applyThemeScript } from "@/components/ui/ThemeToggle";

import "./globals.css";

/**
 * Root layout for the Landing Agent app shell.
 *
 * FONTS — Plus Jakarta Sans (display/heading) + Inter (body), the `bold-commerce`
 * default pair from DESIGN-SYSTEM §2.2. Both load with `display: "swap"` and a
 * system fallback so above-the-fold text never waits on a webfont (§8.4).
 *
 * The other seven locked font keys (Outfit, Fraunces, Instrument Serif, DM Sans,
 * Manrope, Sora, Clash Display) are loaded per-page by the renderer from
 * `page.theme.headingFont` / `bodyFont`. Loading all nine here would cost LCP on
 * every page for fonts most pages never use.
 *
 * TOKEN WIRING — `next/font` mangles the real family name (`__Plus_Jakarta_Sans_ab12`),
 * so the literal `"Plus Jakarta Sans"` in globals.css `@theme` would silently miss the
 * loaded font and fall through to system-ui. We therefore point `--font-heading` /
 * `--font-body` at the generated variables on <body>.
 *
 * Doing this on <body> rather than :root is deliberate: a rendered landing page sets
 * its own `--font-heading` on its `[data-lp-personality]` / `[data-lp-theme]` root,
 * and a declaration on a descendant always wins over an inherited value. The app
 * chrome keeps its fonts; the canvas keeps the brand's. DESIGN-SYSTEM §2.3.
 */

const plusJakarta = Plus_Jakarta_Sans({
  variable: "--font-plus-jakarta",
  subsets: ["latin"],
  display: "swap",
});

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
  display: "swap",
});

const APP_FONT_TOKENS = {
  "--font-heading": "var(--font-plus-jakarta), ui-sans-serif, system-ui, sans-serif",
  "--font-body": "var(--font-inter), ui-sans-serif, system-ui, sans-serif",
} as React.CSSProperties;

export const metadata: Metadata = {
  title: {
    default: "Landing Agent",
    template: "%s · Landing Agent",
  },
  description:
    "Generate and visually edit high-converting D2C landing pages for Indian e-commerce brands.",
  applicationName: "Landing Agent",
  // Internal tool. The generated landing pages set their own metadata; the shell
  // itself must never be indexed.
  robots: { index: false, follow: false },
  formatDetection: { telephone: false, address: false, email: false },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover", // env(safe-area-inset-*) needs this. DESIGN-SYSTEM §5.5.
  themeColor: "#ffffff",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en-IN"
      // globals.css sets `scroll-behavior: smooth` on <html>. As of Next.js 16 the
      // router no longer neutralises that during SPA navigation unless this
      // attribute is present — without it, every route change animates a scroll.
      data-scroll-behavior="smooth"
      className={`${plusJakarta.variable} ${inter.variable} h-full antialiased`}
      suppressHydrationWarning
    >
      <head>
        {/* Sets data-theme before first paint so there is no light→dark flash. */}
        <script dangerouslySetInnerHTML={{ __html: applyThemeScript }} />
      </head>
      <body
        className="app-shell flex min-h-full flex-col bg-app-bg text-app-fg"
        style={APP_FONT_TOKENS}
      >
        {children}
      </body>
    </html>
  );
}

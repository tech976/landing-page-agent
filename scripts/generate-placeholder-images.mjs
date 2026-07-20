/**
 * Generates the placeholder .webp assets the seeded Kaarva example page references.
 *
 * The mock page (src/lib/generate/mock.ts) points at /img/kaarva/*.webp. Those are stand-ins
 * for real product photography — they exist so a fresh clone renders a complete, unbroken
 * page offline. Replace them with real assets before showing the page to anyone.
 *
 *   node scripts/generate-placeholder-images.mjs [outDir]
 *
 * `sharp` comes in transitively with Next.js (it powers next/image optimisation), so this
 * needs no extra dependency.
 */
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import sharp from "sharp";

const OUT = process.argv[2] ?? path.join(process.cwd(), "public", "img", "kaarva");

const NAMES = [
  "bifold-wallet", "care-kit", "founder-meera", "kanpur-workshop",
  "laptop-folio", "meera-dimensions", "meera-grain-detail", "meera-interior",
  "meera-on-shoulder", "meera-patina", "meera-tan-hero", "persona-commuter",
  "persona-gift", "persona-weekend", "rehan-sling", "rev-ananya",
  "rev-priya-patina", "set-gift", "set-tote-sling", "set-tote",
];

// Warm full-grain leather palette — tans, saddles, umbers.
const PAIRS = [
  ["#c8935a", "#8a5a2b"], ["#b8834c", "#7a4a22"], ["#d2a066", "#96633a"],
  ["#a9743f", "#6d4020"], ["#c08a52", "#84512a"], ["#d8ab74", "#a06d3f"],
];

const esc = (s) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

function svg(name, i) {
  const [a, b] = PAIRS[i % PAIRS.length];
  const label = esc(name.replace(/-/g, " ").toUpperCase());
  return `<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="1200">
  <defs>
    <linearGradient id="g" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%" stop-color="${a}"/><stop offset="100%" stop-color="${b}"/>
    </linearGradient>
  </defs>
  <rect width="1200" height="1200" fill="url(#g)"/>
  <circle cx="600" cy="470" r="190" fill="none" stroke="#ffffff" stroke-opacity="0.30" stroke-width="3"/>
  <text x="600" y="500" text-anchor="middle" font-family="Georgia,serif"
        font-size="120" fill="#ffffff" fill-opacity="0.85" letter-spacing="14">KAARVA</text>
  <text x="600" y="800" text-anchor="middle" font-family="Helvetica,Arial,sans-serif"
        font-size="44" fill="#ffffff" fill-opacity="0.92" letter-spacing="3">${label}</text>
  <text x="600" y="864" text-anchor="middle" font-family="Helvetica,Arial,sans-serif"
        font-size="28" fill="#ffffff" fill-opacity="0.62" letter-spacing="4">PLACEHOLDER ASSET</text>
</svg>`;
}

await mkdir(OUT, { recursive: true });

for (const [i, name] of NAMES.entries()) {
  const buf = await sharp(Buffer.from(svg(name, i))).webp({ quality: 82 }).toBuffer();
  await writeFile(path.join(OUT, `${name}.webp`), buf);
}

console.log(`Wrote ${NAMES.length} webp placeholders to ${OUT}`);

/**
 * Mobile horizontal-overflow regression guard.
 *
 * ~67% of Indian paid traffic is mobile, so a page that scrolls sideways at 360px
 * is a real conversion bug. This class of defect is invisible to tsc, next build
 * and eslint — it only appears in a real layout engine, which is why it lives here.
 *
 * On failure it names the specific block that leaks, by hiding blocks one at a time
 * and re-measuring, so the next person does not have to rediscover the technique.
 *
 * Usage:  node scripts/check-mobile-overflow.mjs [baseUrl] [pageId]
 * Requires the dev server to be running.
 */
import { chromium } from 'playwright';

const BASE = process.argv[2] || 'http://localhost:3000';
const PAGE_ID = process.argv[3] || 'page_mock_kaarva';
const WIDTHS = [320, 360, 390, 414];

const browser = await chromium.launch();
let failures = 0;

for (const width of WIDTHS) {
  const ctx = await browser.newContext({
    viewport: { width, height: 780 },
    isMobile: true,
    hasTouch: true,
    deviceScaleFactor: 2,
  });
  const page = await ctx.newPage();
  await page.goto(`${BASE}/preview/${PAGE_ID}`, { waitUntil: 'networkidle' });
  await page.waitForTimeout(400);

  const { overflow, culprits } = await page.evaluate(() => {
    const de = document.documentElement;
    const overflow = de.scrollWidth - de.clientWidth;
    if (overflow <= 1) return { overflow, culprits: [] };

    // Bisect by elimination: whichever block, when hidden, drops scrollWidth to
    // the viewport width is the one leaking.
    const culprits = [];
    for (const blk of document.querySelectorAll('[id^="blk_"]')) {
      const prev = blk.style.display;
      blk.style.display = 'none';
      void de.offsetWidth;
      if (de.scrollWidth - de.clientWidth <= 1) culprits.push(blk.id);
      blk.style.display = prev;
      void de.offsetWidth;
    }
    return { overflow, culprits };
  });

  if (overflow > 1) {
    failures++;
    console.error(
      `FAIL  ${width}px — ${overflow}px horizontal overflow` +
        (culprits.length ? `  → caused by: ${culprits.join(', ')}` : '  → no single block; check fixed/fixture elements'),
    );
  } else {
    console.log(`PASS  ${width}px — no horizontal overflow`);
  }
  await ctx.close();
}

await browser.close();

if (failures) {
  console.error(`\n${failures}/${WIDTHS.length} widths overflow horizontally.`);
  process.exit(1);
}
console.log(`\nAll ${WIDTHS.length} mobile widths clean.`);

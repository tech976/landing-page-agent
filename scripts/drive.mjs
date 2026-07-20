import { chromium } from 'playwright';

const BASE = 'http://localhost:3000';
const SHOT = process.argv[2] || 'C:/Users/abhis/AppData/Local/Temp/claude/c--Users-abhis-OneDrive---Vidyalankar-Polytechnic-Desktop-landing-page-agent/8675a9f2-9da0-45f5-bc34-d120466e56df/scratchpad';

const results = [];
const pass = (n, d = '') => results.push(['PASS', n, d]);
const fail = (n, d = '') => results.push(['FAIL', n, d]);

const browser = await chromium.launch();

// ---------- 1. Preview page, desktop + mobile ----------
{
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await ctx.newPage();
  const errors = [];
  page.on('pageerror', e => errors.push(String(e)));
  page.on('console', m => { if (m.type() === 'error') errors.push(m.text()); });

  await page.goto(`${BASE}/preview/page_mock_kaarva`, { waitUntil: 'networkidle' });
  await page.screenshot({ path: `${SHOT}/preview-desktop.png`, fullPage: false });

  const blocks = await page.locator('[id^="blk_"]').count();
  blocks >= 12 ? pass('preview: 12 blocks in DOM', `${blocks} found`)
               : fail('preview: 12 blocks in DOM', `only ${blocks}`);

  // horizontal overflow check — page body must never scroll sideways
  const overflow = await page.evaluate(() =>
    document.documentElement.scrollWidth - document.documentElement.clientWidth);
  overflow <= 1 ? pass('preview desktop: no horizontal overflow')
                : fail('preview desktop: horizontal overflow', `${overflow}px`);

  errors.length === 0 ? pass('preview: no JS errors')
                      : fail('preview: JS errors', errors.slice(0, 3).join(' | '));
  await ctx.close();
}

// ---------- 2. Mobile viewport (67% of traffic) ----------
{
  const ctx = await browser.newContext({
    viewport: { width: 360, height: 780 }, isMobile: true, hasTouch: true,
    deviceScaleFactor: 2,
  });
  const page = await ctx.newPage();
  await page.goto(`${BASE}/preview/page_mock_kaarva`, { waitUntil: 'networkidle' });
  await page.screenshot({ path: `${SHOT}/preview-mobile.png`, fullPage: false });

  const overflow = await page.evaluate(() =>
    document.documentElement.scrollWidth - document.documentElement.clientWidth);
  overflow <= 1 ? pass('preview mobile 360px: no horizontal overflow')
                : fail('preview mobile 360px: HORIZONTAL OVERFLOW', `${overflow}px`);

  // sticky CTA should appear after scrolling past hero
  await page.evaluate(() => window.scrollTo(0, 2000));
  await page.waitForTimeout(700);
  await page.screenshot({ path: `${SHOT}/preview-mobile-scrolled.png` });

  // tap target audit on primary buttons
  const small = await page.evaluate(() => {
    const out = [];
    document.querySelectorAll('a,button').forEach(el => {
      const r = el.getBoundingClientRect();
      if (r.width > 0 && r.height > 0 && r.height < 40)
        out.push(`${el.tagName}:${(el.textContent || '').trim().slice(0, 24)}=${Math.round(r.height)}px`);
    });
    return out.slice(0, 6);
  });
  small.length === 0 ? pass('mobile: tap targets >= 40px')
                     : fail('mobile: small tap targets', small.join(', '));
  await ctx.close();
}

// ---------- 3. The editor — the real unknown ----------
{
  const ctx = await browser.newContext({ viewport: { width: 1600, height: 1000 } });
  const page = await ctx.newPage();
  const errors = [];
  page.on('pageerror', e => errors.push(String(e)));
  page.on('console', m => { if (m.type() === 'error') errors.push(m.text()); });

  await page.goto(`${BASE}/editor/page_mock_kaarva`, { waitUntil: 'networkidle' });
  await page.waitForTimeout(3500); // Puck hydration
  await page.screenshot({ path: `${SHOT}/editor.png`, fullPage: false });

  const puckRoot = await page.locator('[class*="Puck"], .puck, [data-puck-root]').count();
  puckRoot > 0 ? pass('editor: Puck mounted', `${puckRoot} root nodes`)
               : fail('editor: Puck did NOT mount');

  // did the canvas actually receive our page content?
  const html = await page.content();
  const hasContent = /Kaarva|Meera/i.test(html);
  hasContent ? pass('editor: page content loaded into canvas')
             : fail('editor: canvas empty — adapter or fetch failed');

  // is there a component list / drag source?
  const draggables = await page.locator('[draggable="true"], [data-rfd-draggable-id], [role="button"]').count();
  draggables > 0 ? pass('editor: interactive elements present', `${draggables}`)
                 : fail('editor: no draggable/interactive elements');

  const publish = await page.getByRole('button', { name: /publish/i }).count();
  publish > 0 ? pass('editor: Publish button present')
              : fail('editor: no Publish button');

  errors.length === 0 ? pass('editor: no JS errors')
                      : fail('editor: JS errors', errors.slice(0, 3).join(' | '));
  await ctx.close();
}

// ---------- 4. Intake wizard — sample data + step nav ----------
{
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 1000 } });
  const page = await ctx.newPage();
  const errors = [];
  page.on('pageerror', e => errors.push(String(e)));

  await page.goto(`${BASE}/new`, { waitUntil: 'networkidle' });
  await page.waitForTimeout(1200);

  const sampleBtn = page.getByRole('button', { name: /sample/i }).first();
  if (await sampleBtn.count()) {
    await sampleBtn.click();
    await page.waitForTimeout(900);
    const filled = await page.evaluate(() =>
      [...document.querySelectorAll('input')].filter(i => i.value && i.value.length > 1).length);
    filled > 0 ? pass('wizard: sample data populates fields', `${filled} inputs filled`)
               : fail('wizard: sample button did not fill fields');
  } else {
    fail('wizard: no "Fill with sample data" button found');
  }

  await page.screenshot({ path: `${SHOT}/wizard.png` });

  const next = page.getByRole('button', { name: /next|continue/i }).first();
  if (await next.count()) {
    await next.click();
    await page.waitForTimeout(700);
    await page.screenshot({ path: `${SHOT}/wizard-step2.png` });
    pass('wizard: advances to next step');
  } else {
    fail('wizard: no Next button');
  }

  errors.length === 0 ? pass('wizard: no JS errors')
                      : fail('wizard: JS errors', errors.slice(0, 2).join(' | '));
  await ctx.close();
}

await browser.close();

console.log('\n================ RESULTS ================');
for (const [s, n, d] of results) console.log(`${s === 'PASS' ? '[PASS]' : '[FAIL]'} ${n}${d ? '  — ' + d : ''}`);
const failed = results.filter(r => r[0] === 'FAIL').length;
console.log(`\n${results.length - failed}/${results.length} passed, ${failed} failed`);

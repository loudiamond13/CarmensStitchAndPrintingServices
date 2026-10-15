// The sign-in brand panel keeps its words clear of the slab (plan 04-32, owner rulings OQ-8 and OQ-9). The owner found
// the headline "ORDERS, PAYMENTS AND EXPENSES, ALL IN ONE PLACE." and the "STAFF AREA" eyebrow hard to read where they
// ran over the orange slab and its black stripes. This spec loads the S1 page at the height of the window
// (`login-brand-viewport`, the real `min-h-dvh` frame) and measures, at 320, 390, 768, 1024, 1440 and 1920 px wide and at
// three window heights each:
//   - the eyebrow and the headline boxes never intersect the slab box or the stripes box (the boxes are larger than
//     what is painted, because the slab is clipped, so this is the stricter test); on phones the quote is hidden;
//   - the text colour keeps at least 4.5:1 (WCAG 1.4.3) against the panel colour, and against the darkest dot of the mesh
//     (the --ink dots at 9%) that can sit right behind a glyph;
//   - in Espresso as well as Blush.
// It loads the implementation side of the parity build and is guarded like every visual spec. Run it with
// `npm --prefix web run parity -- --grep @brand`.
import type { Page } from '@playwright/test';
import { fileURLToPath } from 'node:url';
import { expect, expectCases, test } from './guard.ts';
import { routeDist } from './serve.ts';

const APP_ORIGIN = 'https://app.parity.test';
const PARITY_DIST = fileURLToPath(new URL('../.parity-dist', import.meta.url));
const CASE = 'login-brand-viewport';

test.beforeEach(async ({ page }) => {
  await routeDist(page, { origin: APP_ORIGIN, distDir: PARITY_DIST });
});

interface Box {
  readonly left: number;
  readonly top: number;
  readonly right: number;
  readonly bottom: number;
}

interface BrandMeasure {
  readonly quoteShown: boolean;
  readonly eyebrow: Box;
  readonly headline: Box;
  readonly slab: Box;
  readonly bands: Box;
  readonly brand: Box;
  /** Contrast ratios, text colour against the panel colour and against the darkest mesh dot. */
  readonly contrast: {
    readonly eyebrowOnPanel: number;
    readonly eyebrowOnDot: number;
    readonly headlineOnPanel: number;
    readonly headlineOnDot: number;
  };
}

// Runs in the page. The brand panel is the first child of the page frame; its children are the slab, the stripes, the
// numeral, the logo wrapper and, last, the quote (eyebrow span, headline p).
const MEASURE = `(() => {
  const root = document.querySelector('[data-case="${CASE}"]');
  const brand = root.firstElementChild.firstElementChild;
  const quote = brand.lastElementChild;
  const [slab, bands] = brand.children;
  const eyebrow = quote.querySelector('span');
  const headline = quote.querySelector('p');
  const box = (element) => {
    const r = element.getBoundingClientRect();
    return { left: r.left, top: r.top, right: r.right, bottom: r.bottom };
  };
  const canvas = document.createElement('canvas').getContext('2d', { willReadFrequently: true });
  const rgb = (css) => {
    canvas.clearRect(0, 0, 1, 1);
    canvas.fillStyle = '#000';
    canvas.fillStyle = css;
    canvas.fillRect(0, 0, 1, 1);
    return Array.from(canvas.getImageData(0, 0, 1, 1).data).slice(0, 3);
  };
  const channel = (value) => {
    const s = value / 255;
    return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
  };
  const luminance = ([r, g, b]) => 0.2126 * channel(r) + 0.7152 * channel(g) + 0.0722 * channel(b);
  const ratio = (a, b) => {
    const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
    return (hi + 0.05) / (lo + 0.05);
  };
  const panel = rgb(getComputedStyle(brand).backgroundColor);
  const ink = rgb(getComputedStyle(root).getPropertyValue('--ink'));
  // The darkest dot of the mesh: --ink at 9% over the panel colour.
  const dot = panel.map((value, index) => Math.round(value * 0.91 + ink[index] * 0.09));
  const eyebrowColor = rgb(getComputedStyle(eyebrow).color);
  const headlineColor = rgb(getComputedStyle(headline).color);
  return {
    quoteShown: quote.getClientRects().length > 0,
    eyebrow: box(eyebrow),
    headline: box(headline),
    slab: box(slab),
    bands: box(bands),
    brand: box(brand),
    contrast: {
      eyebrowOnPanel: ratio(eyebrowColor, panel),
      eyebrowOnDot: ratio(eyebrowColor, dot),
      headlineOnPanel: ratio(headlineColor, panel),
      headlineOnDot: ratio(headlineColor, dot),
    },
  };
})()`;

function intersects(a: Box, b: Box): boolean {
  return a.left < b.right && a.right > b.left && a.top < b.bottom && a.bottom > b.top;
}

async function open(page: Page, theme: 'light' | 'dark'): Promise<void> {
  const response = await page.goto(`${APP_ORIGIN}/parity.html?case=${CASE}&theme=${theme}`);
  expect(response?.status()).toBe(200);
  expect(await expectCases(page)).toBe(1);
  expect(await page.evaluate('document.fonts.ready.then(() => document.fonts.status)')).toBe('loaded');
}

for (const width of [320, 390, 768, 1024, 1440, 1920]) {
  test(`@layouts-auth @brand the headline and eyebrow stay off the slab and keep 4.5:1 at ${String(width)}px`, async ({
    page,
  }) => {
    await page.setViewportSize({ width, height: 900 });
    await open(page, 'light');

    for (const height of [600, 900, 1200]) {
      await page.setViewportSize({ width, height });
      const measured: BrandMeasure = await page.evaluate(MEASURE);
      const where = `${String(width)}x${String(height)}`;

      if (width < 768) {
        // App. C hides the quote on phones, so there is no text to clear.
        expect(measured.quoteShown, `${where}: quote hidden on phones`).toBe(false);
        continue;
      }
      expect(measured.quoteShown, `${where}: quote shown`).toBe(true);
      for (const [name, text] of [
        ['eyebrow', measured.eyebrow],
        ['headline', measured.headline],
      ] as const) {
        expect(intersects(text, measured.slab), `${where}: ${name} over the slab`).toBe(false);
        expect(intersects(text, measured.bands), `${where}: ${name} over the stripes`).toBe(false);
        // Both sit inside the panel, not cut off.
        expect(text.left, `${where}: ${name} inside the panel`).toBeGreaterThanOrEqual(measured.brand.left);
        expect(text.bottom, `${where}: ${name} inside the panel`).toBeLessThanOrEqual(measured.brand.bottom);
      }
      expect(measured.contrast.eyebrowOnPanel, `${where}: eyebrow on the panel`).toBeGreaterThanOrEqual(4.5);
      expect(measured.contrast.eyebrowOnDot, `${where}: eyebrow on a dot`).toBeGreaterThanOrEqual(4.5);
      expect(measured.contrast.headlineOnPanel, `${where}: headline on the panel`).toBeGreaterThanOrEqual(4.5);
      expect(measured.contrast.headlineOnDot, `${where}: headline on a dot`).toBeGreaterThanOrEqual(4.5);
    }
  });
}

for (const width of [768, 1440]) {
  test(`@layouts-auth @brand Espresso: the words stay off the slab and keep 4.5:1 at ${String(width)}px`, async ({
    page,
  }) => {
    await page.setViewportSize({ width, height: 900 });
    await open(page, 'dark');

    const measured: BrandMeasure = await page.evaluate(MEASURE);

    expect(intersects(measured.eyebrow, measured.slab)).toBe(false);
    expect(intersects(measured.headline, measured.slab)).toBe(false);
    expect(intersects(measured.headline, measured.bands)).toBe(false);
    expect(measured.contrast.eyebrowOnPanel).toBeGreaterThanOrEqual(4.5);
    expect(measured.contrast.eyebrowOnDot).toBeGreaterThanOrEqual(4.5);
    expect(measured.contrast.headlineOnPanel).toBeGreaterThanOrEqual(4.5);
    expect(measured.contrast.headlineOnDot).toBeGreaterThanOrEqual(4.5);
  });
}

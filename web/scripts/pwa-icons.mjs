// @ts-check
// One-off (run by hand, not part of any build): draws the staff app icons (PERF-06, UI-SPEC W1) from web/public/mark.svg
// into web/public/pwa/. It reads the SVG from disk, so no dev server is needed. Needs the Playwright Chromium that
// `npx playwright install chromium` fetches. Commit the four PNGs after a run.
//   Run: node web/scripts/pwa-icons.mjs
// The art is never redrawn, recoloured, turned or stretched: only an even scale, and the tile's own orange in the corners.
import { mkdirSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const ORANGE = '#ff6600';
const MARK = fileURLToPath(new URL('../public/mark.svg', import.meta.url));
const OUT = fileURLToPath(new URL('../public/pwa/', import.meta.url));

// name, size, art share of the square, whether the corners are filled with the tile's orange.
const ICONS = [
  { name: 'icon-192.png', size: 192, share: 1, filled: false },
  { name: 'icon-512.png', size: 512, share: 1, filled: false },
  // SPEC-DEVIATION: ICON-BLEED. Android masks this one, so the square is full orange and the art sits at 72%.
  { name: 'icon-maskable-512.png', size: 512, share: 0.72, filled: true },
  // SPEC-DEVIATION: ICON-BLEED. iOS paints transparent corners black, so the square is full orange with the art at 100%.
  { name: 'apple-touch-icon-180.png', size: 180, share: 1, filled: true },
];

/**
 * The page that holds one icon: the mark scaled evenly and centred on a square, orange or transparent.
 * @param {string} svg The mark's SVG text.
 * @param {number} size The square's side in pixels.
 * @param {number} share The art's share of the side.
 * @param {boolean} filled Whether the square is filled with the tile's orange.
 */
function pageFor(svg, size, share, filled) {
  const art = Math.round(size * share);
  const background = filled ? ORANGE : 'transparent';
  return `<!doctype html><html><body style="margin:0;background:${background}">
<div style="width:${String(size)}px;height:${String(size)}px;display:flex;align-items:center;justify-content:center">
<div style="width:${String(art)}px;height:${String(art)}px">${svg.replace('<svg ', '<svg width="100%" height="100%" ')}</div>
</div></body></html>`;
}

const { chromium } = await import('@playwright/test');
const svg = readFileSync(MARK, 'utf8').replace(/ width="\d+" height="\d+"/u, '');
mkdirSync(OUT, { recursive: true });

const browser = await chromium.launch();
try {
  for (const { name, size, share, filled } of ICONS) {
    const context = await browser.newContext({ deviceScaleFactor: 1, viewport: { width: size, height: size } });
    const page = await context.newPage();
    await page.setContent(pageFor(svg, size, share, filled));
    await page.screenshot({
      path: `${OUT}${name}`,
      clip: { x: 0, y: 0, width: size, height: size },
      omitBackground: !filled,
    });
    await context.close();
    process.stdout.write(`pwa-icons: wrote ${OUT}${name}\n`);
  }
} finally {
  await browser.close();
}

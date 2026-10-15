// @ts-check
// One-off (run by hand, not part of any build): renders the horizontal CSPS lockup for the auth emails (D-30) to
// src/Csps.Infrastructure/Email/Assets/csps-logo.png, a 360 px wide PNG (2x of the 180 px the emails show).
//   1. Start the dev server:  npm --prefix web run dev   (http://localhost:5180)
//   2. Run:                   node web/scripts/render-email-logo.mjs [--base-url http://localhost:5180]
// It copies the Logo of the showcase case "logo-lg" onto a #fff6f0 (the email card colour) page, scales it to 180 px
// and takes a clip at device scale factor 2. Commit the PNG; the build embeds it.
import { mkdirSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from '@playwright/test';

const CARD = '#fff6f0';
const EMAIL_WIDTH = 180;
const OUTPUT = fileURLToPath(new URL('../../src/Csps.Infrastructure/Email/Assets/csps-logo.png', import.meta.url));

const flag = process.argv.indexOf('--base-url');
const baseUrl = flag > -1 && process.argv[flag + 1] ? process.argv[flag + 1] : 'http://localhost:5180';

const browser = await chromium.launch();
try {
  const context = await browser.newContext({ deviceScaleFactor: 2, viewport: { width: 1200, height: 900 }, colorScheme: 'light' });
  const page = await context.newPage();
  await page.goto(`${baseUrl}/dev/components`, { waitUntil: 'networkidle' });
  const source = page.locator('[data-case="logo-lg"] [role="img"]').first();
  await source.waitFor();
  await page.evaluate(() => document.fonts.ready);

  // Copy the lockup to the top left of a clean card-coloured layer, scaled so it is exactly 180 px wide.
  await page.evaluate(
    ({ card, width }) => {
      const logo = document.querySelector('[data-case="logo-lg"] [role="img"]');
      if (logo === null) {
        throw new Error('No logo-lg lockup on the showcase.');
      }
      const layer = document.createElement('div');
      layer.id = 'email-logo-layer';
      layer.setAttribute('style', `position:fixed;inset:0;z-index:2147483647;background:${card};`);
      const copy = /** @type {HTMLElement} */ (logo.cloneNode(true));
      copy.id = 'email-logo-copy';
      layer.append(copy);
      document.body.append(layer);
      const natural = copy.getBoundingClientRect().width;
      copy.style.zoom = String(width / natural);
    },
    { card: CARD, width: EMAIL_WIDTH },
  );

  const box = await page.locator('#email-logo-copy').boundingBox();
  if (box === null) {
    throw new Error('The copied lockup has no box.');
  }
  mkdirSync(path.dirname(OUTPUT), { recursive: true });
  await page.screenshot({
    path: OUTPUT,
    clip: { x: Math.floor(box.x), y: Math.floor(box.y), width: EMAIL_WIDTH, height: Math.ceil(box.height) },
  });
  process.stdout.write(`render-email-logo: wrote ${OUTPUT}\n`);
} finally {
  await browser.close();
}

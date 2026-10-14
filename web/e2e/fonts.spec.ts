// Font proof in the real browser (PERF-05; UI-SPEC Typography → Fonts; plan 02-12 handed this check to plan 02-35).
//   - The page preloads exactly one font, the Archivo Variable latin woff2, and every font it loads is a woff2 file from
//     the app's own origin.
//   - `document.fonts.check('16px "Archivo Variable"', '₱')` is true once the showcase has rendered money.
//   - ₱ renders in Archivo Variable, never in a system font: in the KPI value and the large display Money (Barlow
//     Condensed has no ₱, so its stack falls through to Archivo Variable, base.css) and in body Money (Archivo itself).
//     Proof in every engine: inside the element that shows it, a run of ten ₱ in that element's own font stack is
//     exactly as wide as the same run in "Archivo Variable" and clearly narrower or wider than in Arial (a probe span that
//     inherits every other font property; its whole box is measured, which every engine reports to the subpixel). In
//     Chromium and Firefox the ₱ drawn in place is also measured on its own (a Range over the one character) against the
//     Archivo run; WebKit rounds single-character Range boxes to whole pixels, so it relies on the run. Kerning is turned
//     off while measuring. No screenshot is used: in WebKit, Playwright's screenshotter adds a <style> the strict CSP
//     reports.
//   - Chromium also asks the renderer which fonts drew the KPI value (CDP `CSS.getPlatformFontsForNode`, research A7):
//     only web fonts, Archivo among them.
import type { Page, Response } from '@playwright/test';
import { expect, test } from './fixtures.ts';
import { openPage, PAGES } from './sweep.ts';

const PUBLIC = PAGES.find((pageCase) => pageCase.path === '/');
const SHOWCASE = PAGES.find((pageCase) => pageCase.path === '/dev/components' && pageCase.theme === 'light');

/** Records every font response the page receives. */
function watchFonts(page: Page): Response[] {
  const fonts: Response[] = [];
  page.on('response', (response) => {
    if (response.request().resourceType() === 'font') {
      fonts.push(response);
    }
  });
  return fonts;
}

/** Every font response is a 200 woff2 from the app origin; returns the problems. */
async function fontProblems(fonts: readonly Response[], origin: string): Promise<string[]> {
  const problems: string[] = [];
  for (const response of fonts) {
    const url = new URL(response.url());
    const type = (await response.headerValue('content-type')) ?? '';
    if (url.origin !== origin) {
      problems.push(`${response.url()} is not from ${origin}`);
    }
    if (!url.pathname.endsWith('.woff2') || type !== 'font/woff2') {
      problems.push(`${response.url()} is ${type || 'untyped'}, not woff2`);
    }
    if (response.status() !== 200) {
      problems.push(`${response.url()} answered ${String(response.status())}`);
    }
  }
  return problems;
}

/** The preload links in the document head. */
const READ_PRELOADS = `[...document.querySelectorAll('link[rel="preload"]')].map((link) => ({
  as: link.getAttribute('as'),
  href: link.getAttribute('href'),
  type: link.getAttribute('type'),
  crossorigin: link.hasAttribute('crossorigin'),
}))`;

interface Preload {
  readonly as: string | null;
  readonly href: string | null;
  readonly type: string | null;
  readonly crossorigin: boolean;
}

for (const pageCase of [PUBLIC, SHOWCASE]) {
  if (pageCase === undefined) {
    throw new Error('sweep.ts no longer lists / or /dev/components');
  }
  test(`@fonts ${pageCase.name} preloads one font and loads only same-origin woff2 fonts`, async ({
    page,
    baseURL,
  }) => {
    const fonts = watchFonts(page);
    await openPage(page, pageCase);

    const preloads = await page.evaluate<Preload[]>(READ_PRELOADS);
    expect(preloads).toHaveLength(1);
    expect(preloads[0]).toMatchObject({ as: 'font', type: 'font/woff2', crossorigin: true });
    expect(preloads[0]?.href).toMatch(/^\/assets\/archivo-latin-wght-normal-[\w-]+\.woff2$/);

    expect(fonts.length).toBeGreaterThan(0);
    expect(await fontProblems(fonts, new URL(baseURL ?? 'https://localhost:5199').origin)).toEqual([]);
  });
}

/** One measured ₱: its font stack, a run of ten ₱ in that stack, in "Archivo Variable" and in Arial, and one in place. */
interface PesoGlyph {
  readonly found: boolean;
  readonly family: string;
  readonly stackRun: number;
  readonly archivoRun: number;
  readonly arialRun: number;
  readonly inPlace: number;
}

/** Ten ₱: a run long enough that one font's ₱ can never measure like another's. */
const PESO_RUN = 10;

/**
 * Measures the first ₱ inside `[data-case=<id>]`. The element whose own text holds it gets `font-kerning: none` while
 * measuring, and three probe spans inherit every other font property from it: one with no font family of its own (the
 * element's stack), one in "Archivo Variable" and one in Arial (set through the CSSOM, which the CSP allows). Everything
 * is put back afterwards. Also marks the element for the CDP lookup.
 */
function measurePeso(caseId: string): string {
  return `(() => {
    const frame = document.querySelector('[data-case="${caseId}"]');
    const walker = document.createTreeWalker(frame, NodeFilter.SHOW_TEXT);
    let text = null;
    for (let node = walker.nextNode(); node; node = walker.nextNode()) {
      if (node.data.includes('₱')) { text = node; break; }
    }
    if (!text) return { found: false, family: '', stackRun: 0, archivoRun: 0, arialRun: 0, inPlace: 0 };
    const host = text.parentElement;
    host.setAttribute('data-e2e-peso', '${caseId}');
    const kerning = host.style.fontKerning;
    host.style.fontKerning = 'none';
    const run = (family) => {
      const span = document.createElement('span');
      span.textContent = '₱'.repeat(${String(PESO_RUN)});
      if (family) span.style.fontFamily = family;
      host.appendChild(span);
      const width = span.getBoundingClientRect().width;
      span.remove();
      return width;
    };
    const range = document.createRange();
    range.setStart(text, text.data.indexOf('₱'));
    range.setEnd(text, text.data.indexOf('₱') + 1);
    const result = {
      found: true,
      family: getComputedStyle(host).fontFamily,
      stackRun: run(null),
      archivoRun: run('"Archivo Variable"'),
      arialRun: run('Arial'),
      inPlace: range.getBoundingClientRect().width,
    };
    host.style.fontKerning = kerning;
    return result;
  })()`;
}

test('@fonts ₱ renders in Archivo Variable in the KPI value, the display Money and body Money', async ({
  page,
  browserName,
}) => {
  if (SHOWCASE === undefined) {
    throw new Error('sweep.ts no longer lists /dev/components');
  }
  await openPage(page, SHOWCASE);
  // The showcase renders money, so the subset that holds ₱ (U+20B1) has loaded by now.
  expect(await page.evaluate<boolean>(`document.fonts.check('16px "Archivo Variable"', '₱')`)).toBe(true);

  const cases = [
    // KpiCard value: the display stack (Barlow Condensed first), 700.
    { id: 'kpi-income', stack: /^"?Barlow Condensed"?,/ },
    // Money size lg: the display stack, 700.
    { id: 'money-lg-success', stack: /^"?Barlow Condensed"?,/ },
    // Money at body size: the sans stack (Archivo Variable first).
    { id: 'money-positive', stack: /^"?Archivo Variable"?,/ },
  ];
  for (const { id, stack } of cases) {
    const glyph = await page.evaluate<PesoGlyph>(measurePeso(id));
    expect(glyph.found, `${id} shows ₱`).toBe(true);
    expect(glyph.family, `${id} font stack`).toMatch(stack);
    // The measurement can tell the two fonts apart, and the element's own stack draws ₱ in Archivo Variable.
    expect(Math.abs(glyph.archivoRun - glyph.arialRun), `${id}: Archivo and Arial ₱ runs differ`).toBeGreaterThan(1);
    expect(Math.abs(glyph.stackRun - glyph.archivoRun), `${id}: ₱ run in the stack vs Archivo Variable`).toBeLessThan(
      0.01,
    );
    if (browserName !== 'webkit') {
      // The ₱ drawn in place has Archivo's advance (letter-spacing included, as in the run), to within the 1/64 px
      // layout unit Chromium places text with (the ₱ of Archivo and of Arial differ by more than 2 px).
      expect(
        Math.abs(glyph.inPlace - glyph.archivoRun / PESO_RUN),
        `${id}: ₱ in place vs Archivo Variable`,
      ).toBeLessThan(0.05);
    }
  }

  if (browserName === 'chromium') {
    // Chromium only (CDP): the fonts the renderer used for the KPI value's text are all web fonts, Archivo among them
    // for ₱ and Barlow Condensed for the digits.
    const cdp = await page.context().newCDPSession(page);
    await cdp.send('DOM.enable');
    await cdp.send('CSS.enable');
    const { root } = await cdp.send('DOM.getDocument', { depth: -1 });
    const { nodeId } = await cdp.send('DOM.querySelector', {
      nodeId: root.nodeId,
      selector: '[data-e2e-peso="kpi-income"]',
    });
    const { fonts } = await cdp.send('CSS.getPlatformFontsForNode', { nodeId });
    expect(fonts.length).toBeGreaterThan(0);
    expect(
      fonts.filter((font) => !font.isCustomFont).map((font) => font.familyName),
      'system fonts used',
    ).toEqual([]);
    expect(fonts.some((font) => /archivo/i.test(font.familyName))).toBe(true);
    expect(fonts.some((font) => /barlow/i.test(font.familyName))).toBe(true);
    await cdp.detach();
  }
});

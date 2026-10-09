// Overflow edges of the list toolkit (plan 02-30; PERF-03; UI considerations "overflow | FilterBar active chips at
// 320px" and "overflow | ResponsiveTable at tablet"). The look of these cases is the parity suite's job; this spec
// measures what a screenshot comparison cannot state on its own: with four active filter chips at 320px the chips wrap
// onto new lines, the long one ends in an ellipsis and the page never scrolls sideways; and on a tablet page the Users
// table scrolls inside its frame while the page does not. It loads the implementation side of the parity build
// (the dev-route parity page, served under the production StrictCsp; nothing opens a port) and is guarded like every
// visual spec (console, page errors, CSP, failed requests). Run it with `npm --prefix web run parity -- --grep @lists`.
import { expect, expectCases, test } from './guard.ts';
import { routeDist } from './serve.ts';
import { fileURLToPath } from 'node:url';

/** The implementation side's origin and build, as in parity.spec.ts (`npm run parity` builds it). */
const APP_ORIGIN = 'https://app.parity.test';
const PARITY_DIST = fileURLToPath(new URL('../.parity-dist', import.meta.url));

test.beforeEach(async ({ page }) => {
  await routeDist(page, { origin: APP_ORIGIN, distDir: PARITY_DIST });
});

interface ChipMeasure {
  pageScroll: number;
  viewport: number;
  chips: number;
  lines: number;
  widest: number;
  truncated: boolean;
  ellipsis: string;
}

interface TableMeasure {
  pageScroll: number;
  viewport: number;
  frameScroll: number;
  frameWidth: number;
  frameRight: number;
  hiddenRight: number;
  overflowX: string;
  tableMin: string;
}

async function openCase(page: import('@playwright/test').Page, id: string, width: number): Promise<void> {
  await page.setViewportSize({ width, height: 900 });
  const response = await page.goto(`${APP_ORIGIN}/parity.html?case=${id}&theme=light`);
  expect(response?.status()).toBe(200);
  expect(await expectCases(page)).toBe(1);
  expect(await page.evaluate('document.fonts.ready.then(() => document.fonts.status)')).toBe('loaded');
}

test('@lists @overflow four filter chips wrap at 320px, the long one truncates, and the page never scrolls sideways', async ({
  page,
}) => {
  await openCase(page, 'filterbar-chips-4', 320);
  const measured: ChipMeasure = await page.evaluate(`(() => {
    const chips = [...document.querySelectorAll('[data-case="filterbar-chips-4"] button[aria-label^="Clear "]')]
      .map((button) => button.parentElement);
    const tops = new Set(chips.map((chip) => Math.round(chip.getBoundingClientRect().top)));
    const long = chips[3].firstElementChild;
    return {
      pageScroll: document.documentElement.scrollWidth,
      viewport: window.innerWidth,
      chips: chips.length,
      lines: tops.size,
      widest: Math.max(...chips.map((chip) => chip.getBoundingClientRect().right)),
      truncated: long.scrollWidth > long.clientWidth,
      ellipsis: getComputedStyle(long).textOverflow,
    };
  })()`);
  expect(measured.chips).toBe(4);
  expect(measured.lines).toBeGreaterThan(1);
  expect(measured.widest).toBeLessThanOrEqual(measured.viewport);
  expect(measured.pageScroll).toBeLessThanOrEqual(measured.viewport);
  expect(measured.truncated).toBe(true);
  expect(measured.ellipsis).toBe('ellipsis');
});

// The Users table on a tablet page. At 820px it fits the full-width frame and nothing scrolls sideways. At 768px the
// table (680px at least, wider with its content) scrolls inside its frame, and every visible part stays inside the
// viewport; the page itself still scrolls sideways by the visually hidden "Actions" header text, which the approved
// CSS places against the page root, not the frame. That is the approved computed result (rule 8); the owner decides
// whether to contain it (deferred-items.md, "Owner decisions pending", plan 02-30). When the owner rules, the 768px
// expectation becomes pageScroll <= viewport like the others.
for (const [width, scrolls] of [
  [768, true],
  [820, false],
] as const) {
  test(`@lists @overflow the Users table on a ${String(width)}px tablet page scrolls inside its frame, its visible parts inside the page`, async ({
    page,
  }) => {
    await openCase(page, 'rt-users-populated', width);
    const measured: TableMeasure = await page.evaluate(`(() => {
      const frame = document.querySelector('[data-case="rt-users-populated"] [role="region"]');
      const table = frame.querySelector('table');
      const hidden = table.querySelector('thead th:last-child > span');
      return {
        pageScroll: document.documentElement.scrollWidth,
        viewport: window.innerWidth,
        frameScroll: frame.scrollWidth,
        frameWidth: frame.clientWidth,
        frameRight: frame.getBoundingClientRect().right,
        hiddenRight: Math.ceil(hidden.getBoundingClientRect().right),
        overflowX: getComputedStyle(frame).overflowX,
        tableMin: getComputedStyle(table).minWidth,
      };
    })()`);
    expect(measured.tableMin).toBe('680px');
    expect(measured.overflowX).toBe('auto');
    expect(measured.frameScroll > measured.frameWidth).toBe(scrolls);
    expect(measured.frameRight).toBeLessThanOrEqual(measured.viewport);
    // Nothing but the 1px hidden "Actions" text may reach past the viewport (owner question pending at 768px).
    expect(measured.pageScroll).toBeLessThanOrEqual(Math.max(measured.viewport, measured.hiddenRight));
    if (!scrolls) {
      expect(measured.pageScroll).toBeLessThanOrEqual(measured.viewport);
    }
  });
}

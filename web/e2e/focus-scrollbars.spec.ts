// The phone tab bar's bottom spacing with real scrollbars (WCAG 2.2 AA 2.4.11; quick 261026-ooe, D-72). Headless Chromium
// hides scrollbars, so this runs only in the two projects that show them (playwright.config.ts). A classic scrollbar
// narrows the page by about 15px, so a window 768 to about 782px wide is still in the phone layout and shows the tab bar.
import type { TestInfo } from '@playwright/test';
import { expect, test } from './fixtures.ts';
import {
  expectClear,
  expectPlaced,
  focusWithoutScroll,
  openSecurity,
  placeUnderBar,
  readSpacingRow,
  settleAndMeasure,
  showButton,
  confirmPassword,
  updateButton,
} from './focus.ts';

const isClassic = (testInfo: TestInfo): boolean => testInfo.project.name === 'chromium-classic-scrollbars';

const WIDTHS = [760, 768, 775, 782, 790, 800] as const;

test('@focus-not-obscured the bottom spacing follows the tab bar from 760 to 800px with real scrollbars', async ({
  page,
  request,
  guard,
}, testInfo) => {
  test.setTimeout(120_000);
  await openSecurity(page, request, guard);

  const problems: string[] = [];
  const drawnAtTabletWidth: number[] = [];
  const scrollbars: string[] = [];
  for (const width of WIDTHS) {
    await page.setViewportSize({ width, height: 600 });
    const row = await readSpacingRow(page, `${String(width)}px`);
    const scrollbar = await page.evaluate<number>('window.innerWidth - document.documentElement.clientWidth');
    scrollbars.push(`${String(width)}px: scrollbar ${String(scrollbar)}px, bar ${row.drawn ? 'drawn' : 'not drawn'}`);
    if (row.problem !== null) {
      problems.push(row.problem);
    }
    if (row.drawn && width >= 768) {
      drawnAtTabletWidth.push(width);
    }
    if (isClassic(testInfo)) {
      expect(scrollbar, `a classic scrollbar takes space at ${String(width)}px`).toBeGreaterThan(0);
    } else {
      expect(scrollbar, `an overlay scrollbar takes no space at ${String(width)}px`).toBe(0);
    }
  }
  expect(problems, `spacing matches the tab bar; ${scrollbars.join('; ')}`).toEqual([]);
  if (isClassic(testInfo)) {
    expect(drawnAtTabletWidth, `the tab bar shows at 768px or wider; ${scrollbars.join('; ')}`).not.toEqual([]);
  } else {
    expect(drawnAtTabletWidth, 'with overlay scrollbars the tab bar never shows at 768px or wider').toEqual([]);
  }
});

test('@focus-not-obscured with classic scrollbars a control 30px under the tab bar is scrolled clear at a 775px window', async ({
  page,
  request,
  guard,
}, testInfo) => {
  test.skip(!isClassic(testInfo), 'Needs classic scrollbars that keep a 775px window in the phone layout');
  test.setTimeout(90_000);
  await openSecurity(page, request, guard);
  await page.setViewportSize({ width: 775, height: 600 });

  expectPlaced(await placeUnderBar(updateButton(page), 'tab'), 'Update Password');
  await focusWithoutScroll(showButton(confirmPassword(page)));
  await page.keyboard.press('Tab');
  await expect(updateButton(page)).toBeFocused();
  const measure = await settleAndMeasure(page);
  expect(measure.tabBarTop, `the tab bar is drawn at 775px; ${JSON.stringify(measure)}`).not.toBeNull();
  expectClear(measure, 'Update Password after Tab at 775px with classic scrollbars');
});

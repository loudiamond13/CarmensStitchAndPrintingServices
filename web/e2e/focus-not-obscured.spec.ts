// Focus Not Obscured for the sticky bars (WCAG 2.2 AA 2.4.11; quick 261026-ooe, D-70 to D-72). A control that Tab or
// Shift+Tab reaches must end up with its whole box clear of every sticky bar, inside the visual viewport.
//   - The phone tab bar (pixel and iphone): Tab from New password lands on Confirm new password clear of the bar, and a
//     control 30px under the bar is scrolled clear. The bottom spacing is on exactly where the bar is drawn.
// The real-scrollbar windows are in focus-scrollbars.spec.ts. Page scripts are strings (no DOM types here).
import type { TestInfo } from '@playwright/test';
import { expect, test } from './fixtures.ts';
import {
  confirmPassword,
  expectClear,
  expectPlaced,
  focusWithoutScroll,
  newPassword,
  openSecurity,
  placeUnderBar,
  readSpacingRow,
  settleAndMeasure,
  showButton,
  updateButton,
} from './focus.ts';

const DEVICE_PROJECTS = ['pixel', 'iphone'];
const PHONE_ONLY = 'Needs the phone tab bar (pixel and iphone)';

const isDevice = (testInfo: TestInfo): boolean => DEVICE_PROJECTS.includes(testInfo.project.name);

test('@focus-not-obscured Tab from New password lands on Confirm new password clear of the tab bar', async ({
  page,
  request,
  guard,
}, testInfo) => {
  test.skip(!isDevice(testInfo), PHONE_ONLY);
  test.setTimeout(90_000);
  await openSecurity(page, request, guard);

  await page.evaluate('window.scrollTo({ top: 0, behavior: "instant" })');
  await newPassword(page).focus();
  await page.keyboard.press('Tab');
  await page.keyboard.press('Tab');
  await expect(confirmPassword(page)).toBeFocused();
  const measure = await settleAndMeasure(page);
  expect(measure.label).toBe('Confirm new password');
  expect(measure.tabBarTop, 'the tab bar is drawn').not.toBeNull();
  expectClear(measure, 'Confirm new password after Tab, Tab');
});

test('@focus-not-obscured a control 30px under the tab bar is scrolled clear when Tab reaches it', async ({
  page,
  request,
  guard,
}, testInfo) => {
  test.skip(!isDevice(testInfo), PHONE_ONLY);
  test.setTimeout(90_000);
  await openSecurity(page, request, guard);

  expectPlaced(await placeUnderBar(updateButton(page), 'tab'), 'Update Password');
  await focusWithoutScroll(showButton(confirmPassword(page)));
  await page.keyboard.press('Tab');
  await expect(updateButton(page)).toBeFocused();
  const measure = await settleAndMeasure(page);
  expectClear(measure, 'Update Password after Tab');
});

test('@focus-not-obscured the bottom spacing is on exactly where the tab bar shows', async ({
  page,
  request,
  guard,
}, testInfo) => {
  test.setTimeout(120_000);
  await openSecurity(page, request, guard);

  const widths: (number | null)[] = isDevice(testInfo) ? [null] : [375, 767, 768, 1024, 1280];
  const problems: string[] = [];
  let withBar = 0;
  let withoutBar = 0;
  for (const width of widths) {
    if (width !== null) {
      await page.setViewportSize({ width, height: 600 });
    }
    const row = await readSpacingRow(page, `${width === null ? 'device' : String(width)}px`);
    if (row.drawn) {
      withBar += 1;
    } else {
      withoutBar += 1;
    }
    if (row.problem !== null) {
      problems.push(row.problem);
    }
  }
  expect(problems, 'spacing matches the tab bar at every width').toEqual([]);
  if (!isDevice(testInfo)) {
    expect(withBar, 'a width with the bar').toBeGreaterThan(0);
    expect(withoutBar, 'a width without the bar').toBeGreaterThan(0);
  }
});

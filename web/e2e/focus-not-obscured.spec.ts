// Focus Not Obscured for the sticky bars (WCAG 2.2 AA 2.4.11; quick 261026-ooe, D-70 to D-72). A control that Tab or
// Shift+Tab reaches must end up with its whole box clear of every sticky bar, inside the visual viewport.
//   - The phone tab bar (pixel and iphone): Tab from New password lands on Confirm new password clear of the bar, and a
//     control 30px under the bar is scrolled clear. The bottom spacing is on exactly where the bar is drawn.
//   - The admin top bar (all five projects, at 1280, 820 and phone widths): Shift+Tab to a control 30px under it scrolls
//     it clear. On the phones a Tab pass down and a Shift+Tab pass back through the Security tab stay clear of both bars.
//   - The axe check on Confirm new password (pixel and iphone) while the tab bar covers all but a 9px strip of it.
//   - The public site header (all five projects, on the dev-only /dev/public page that shows the real PublicLayout): the same
//     Shift+Tab check at 1280, 820 and 390px and on the phones.
// The real-scrollbar windows are in focus-scrollbars.spec.ts. Page scripts are strings (no DOM types here).
import { randomUUID } from 'node:crypto';
import type { TestInfo } from '@playwright/test';
import { expect, expectNoAxeViolations, pageAxe, test } from './fixtures.ts';
import {
  confirmPassword,
  currentPassword,
  expectClear,
  expectPlaced,
  focusWithoutScroll,
  measureNow,
  newPassword,
  openSecurity,
  placeStripAboveTabBar,
  placeUnderBar,
  readSpacing,
  readSpacingRow,
  settleAndMeasure,
  showButton,
  topBarHeight,
  updateButton,
  type Measure,
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
    const top = await topBarHeight(page);
    const { paddingTop } = await readSpacing(confirmPassword(page));
    if (top === null || paddingTop < top + 18) {
      problems.push(
        `${String(width)}px: top bar ${String(top)}px but html scroll-padding-top is ${String(paddingTop)}px`,
      );
    }
  }
  expect(problems, 'spacing matches the bars at every width').toEqual([]);
  if (!isDevice(testInfo)) {
    expect(withBar, 'a width with the bar').toBeGreaterThan(0);
    expect(withoutBar, 'a width without the bar').toBeGreaterThan(0);
  }
});

test('@focus-not-obscured a control 30px under the admin top bar is scrolled clear when Shift+Tab reaches it', async ({
  page,
  request,
  guard,
}, testInfo) => {
  test.setTimeout(120_000);
  await openSecurity(page, request, guard);

  // The windows are short (400px) so the Security page can scroll far enough to put the first field behind the bar.
  const phoneWidth = page.viewportSize()?.width ?? 0;
  const sizes = isDevice(testInfo)
    ? [{ width: phoneWidth, height: 400 }]
    : [
        { width: 1280, height: 400 },
        { width: 820, height: 400 },
      ];
  for (const size of sizes) {
    await page.setViewportSize(size);
    const at = `${String(size.width)}x${String(size.height)}`;
    expectPlaced(await placeUnderBar(currentPassword(page), 'top'), `Current password at ${at}`);
    await focusWithoutScroll(showButton(currentPassword(page)));
    await page.keyboard.press('Shift+Tab');
    await expect(currentPassword(page)).toBeFocused();
    expectClear(await settleAndMeasure(page), `Current password after Shift+Tab at ${at}`);
  }
});

/** Presses `key` until `stop` says the focus has arrived (at most 40 presses), checking each control in main. */
async function walk(
  page: Parameters<typeof settleAndMeasure>[0],
  key: 'Tab' | 'Shift+Tab',
  stop: (measure: Measure) => boolean,
): Promise<{ labels: string[]; scrolls: number }> {
  const labels: string[] = [];
  const scrolls = new Set<number>();
  scrolls.add((await measureNow(page)).scrollY);
  for (let step = 0; step < 40; step += 1) {
    await page.keyboard.press(key);
    const measure = await settleAndMeasure(page);
    if (!measure.inMain) {
      break;
    }
    scrolls.add(measure.scrollY);
    expectClear(measure, `${measure.label} after ${key} (step ${String(step + 1)})`);
    labels.push(measure.label);
    await page.evaluate('window.__e2eWalkLast = document.activeElement');
    if (stop(measure)) {
      break;
    }
  }
  return { labels, scrolls: scrolls.size - 1 };
}

test('@focus-not-obscured every Security control stays clear of both bars, tabbing down and back up', async ({
  page,
  request,
  guard,
}, testInfo) => {
  test.skip(!isDevice(testInfo), PHONE_ONLY);
  test.setTimeout(120_000);
  await openSecurity(page, request, guard);

  const securityTab = page.getByRole('tab', { name: 'Security' });
  await page.evaluate('window.scrollTo({ top: 0, behavior: "instant" })');
  await securityTab.focus();
  const down = await walk(page, 'Tab', () => false);
  expect(down.labels.length, `controls going down: ${down.labels.join(', ')}`).toBeGreaterThanOrEqual(6);
  expect(down.labels, 'Confirm new password is among them').toContain('Confirm new password');
  expect(down.scrolls, 'the page scrolled going down').toBeGreaterThanOrEqual(1);

  await page.evaluate('window.scrollTo({ top: document.documentElement.scrollHeight, behavior: "instant" })');
  await page.evaluate('window.__e2eWalkLast.focus({ preventScroll: true })');
  const up = await walk(page, 'Shift+Tab', (measure) => measure.label === 'Security');
  expect(up.labels[up.labels.length - 1], `controls going up: ${up.labels.join(', ')}`).toBe('Security');
  expect(up.scrolls, 'the page scrolled going up').toBeGreaterThanOrEqual(1);
});

test('@focus-not-obscured a control 30px under the public header is scrolled clear when Shift+Tab reaches it', async ({
  page,
}, testInfo) => {
  test.setTimeout(90_000);
  await page.goto('/dev/public');
  await expect(page.getByRole('heading', { level: 1, name: 'Public layout check' })).toBeVisible();

  const phoneWidth = page.viewportSize()?.width ?? 0;
  const sizes = isDevice(testInfo)
    ? [{ width: phoneWidth, height: 480 }]
    : [
        { width: 1280, height: 480 },
        { width: 820, height: 480 },
        { width: 390, height: 480 },
      ];
  for (const size of sizes) {
    await page.setViewportSize(size);
    const at = `${String(size.width)}x${String(size.height)}`;
    const field6 = page.getByLabel('Field 6', { exact: true });
    expectPlaced(await placeUnderBar(field6, 'top'), `Field 6 at ${at}`);
    const header = await topBarHeight(page);
    const { paddingTop } = await readSpacing(field6);
    expect
      .soft(paddingTop, `html scroll-padding-top at ${at} for a ${String(header)}px header`)
      .toBeGreaterThanOrEqual((header ?? Number.POSITIVE_INFINITY) + 18);
    await focusWithoutScroll(page.getByLabel('Field 7', { exact: true }));
    await page.keyboard.press('Shift+Tab');
    await expect(field6).toBeFocused();
    expectClear(await settleAndMeasure(page), `Field 6 after Shift+Tab at ${at}`);
  }
});

test('@focus-not-obscured the axe check passes Confirm new password while the tab bar covers all but a strip of it', async ({
  page,
  request,
  guard,
}, testInfo) => {
  test.skip(!isDevice(testInfo), PHONE_ONLY);
  test.setTimeout(120_000);
  // A long address wraps the profile header onto more lines, so the Confirm field starts low enough to put under the bar.
  const local = Array.from({ length: 5 }, () => randomUUID().replaceAll('-', '')).join('');
  await openSecurity(page, request, guard, { email: `${local}@csps.test` });

  const confirm = confirmPassword(page);
  const showing = await placeStripAboveTabBar(confirm);
  expect(showing, 'the Confirm field could be scrolled until only a strip shows above the tab bar').not.toBeNull();
  expect(Math.abs((showing ?? 0) - 9)).toBeLessThanOrEqual(1);

  const id = await confirm.getAttribute('id');
  const direct = await pageAxe(page).analyze();
  const targetSize = direct.violations.find((violation) => violation.id === 'target-size');
  expect(
    targetSize?.nodes.map((node) => node.target.join(' ')),
    'axe reports the covered field',
  ).toContain(`#${String(id)}`);

  await expectNoAxeViolations(page);
});

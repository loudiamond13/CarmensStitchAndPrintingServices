// Dialogs on short windows (owner ruling D-42, UAT G-2-199, plan 02-41; WCAG 1.4.10 Reflow, A11Y-04, PERF-03). The
// Delete Order dialog of /dev/components on the real host, in an Overlay region (App. C `.s-overlay`):
//   - where it fits it keeps the approved place: 140px down and centred on the whole window on desktop (1440x900),
//     96px down as a full-width sheet on phone pages (412x839);
//   - on a shorter window the gap above it shrinks, down to the 16px edge gap (0 on phone pages), so the whole dialog
//     shows without scrolling (the owner's 1274x585 window; a 393x659 phone page);
//   - when even that is too short (1280x420; a 320x568 phone page) the backdrop scrolls, so the mouse wheel over the
//     dialog and keyboard focus on Delete Order both bring the buttons fully into view, while the scrim still covers
//     the whole window and the page stays axe-clean;
//   - a left click on the dark area still closes it (above the dialog, beside it after the wheel scrolled the backdrop,
//     above the phone sheet), while a middle or a right press there does not (plan 02-42, D-42; the real-scrollbar
//     cases are in dialog-scrollbars.spec.ts);
//   - on a scrolled backdrop a press that does not close leaves the caret in the confirm field and the backdrop where it
//     was (review WR-01, plan 02-43); the phone screens, whose sheet fits without scrolling, check a right press above
//     the sheet instead.
// The desktop and phone-page sizes run in chromium, firefox and webkit; the pixel and iphone projects check their own
// screen instead (touch scrolling cannot be driven by the wheel in mobile emulation, so they scroll Delete Order into
// view directly). Every measurement waits for the dialog's entry animation to finish: its 0.2s rise moves its box.
// Page scripts are strings: the e2e TypeScript program has no DOM types. The Delete Order helpers are shared with
// dialog-scrollbars.spec.ts (deleteOrderDialog.ts).
import type { Page, TestInfo } from '@playwright/test';
import { expect, expectNoAxeViolations, test } from './fixtures.ts';
import {
  boxOf,
  openDeleteOrder,
  ORDER,
  readCaret,
  readRegion,
  topOf,
  waitForFramesAndTask,
  waitForSettledScroll,
  type OpenDialog,
  wheelOverDialog,
} from './deleteOrderDialog.ts';

/** Desktop: the approved top (16px padding + 124px spacer) and the edge gap it may shrink to. */
const DESKTOP_TOP = 140;
const DESKTOP_EDGE = 16;
/** Phone pages: the approved top (no padding + 96px spacer) and the edge gap it may shrink to. */
const PHONE_TOP = 96;
const PHONE_EDGE = 0;

const DEVICE_PROJECTS = ['pixel', 'iphone'];
const DESKTOP_ONLY = 'The pixel and iphone projects check their own screen in the device test.';
const DEVICE_ONLY = 'The desktop engines check the phone-page sizes by setting the window size.';

const isDevice = (testInfo: TestInfo): boolean => DEVICE_PROJECTS.includes(testInfo.project.name);

/** True when Delete Order has the keyboard focus. */
const CONFIRM_FOCUSED = `document.activeElement !== null && document.activeElement.closest('[role="dialog"]') !== null && document.activeElement.textContent.trim() === 'Delete Order'`;

const clamp = (value: number, min: number, max: number): number => Math.min(Math.max(value, min), max);

/** Within 1px (sub-pixel layout and rounding differ between engines). */
function expectNear(actual: number, expected: number, what: string): void {
  expect(Math.abs(actual - expected), `${what}: ${String(actual)}, expected ${String(expected)}`).toBeLessThanOrEqual(
    1,
  );
}

/** The scrim still covers the whole window, so nothing behind the dialog can be reached. */
async function expectWholeWindow(fit: OpenDialog): Promise<void> {
  const region = await boxOf(fit.region, 'the region');
  expectNear(region.x, 0, 'region left');
  expectNear(region.y, 0, 'region top');
  expectNear(region.width, fit.viewport.width, 'region width');
  expectNear(region.height, fit.viewport.height, 'region height');
}

/** Centred on the whole window (the region's client area, which a scrollbar would narrow). */
function expectCentred(fit: OpenDialog): void {
  expectNear(fit.box.x + fit.box.width / 2, fit.metrics.clientWidth / 2, 'dialog centre');
}

/** A full-width sheet on phone pages. */
function expectFullWidthSheet(fit: OpenDialog): void {
  expectNear(fit.box.x, 0, 'sheet left');
  expectNear(fit.box.width, fit.metrics.clientWidth, 'sheet width');
}

function expectNoScrolling(fit: OpenDialog): void {
  expect(fit.metrics.scrollHeight, 'the region does not scroll').toBeLessThanOrEqual(fit.metrics.clientHeight);
}

function expectScrolling(fit: OpenDialog): void {
  expect(fit.metrics.overflowY).toBe('auto');
  expect(fit.metrics.scrollHeight, 'the region scrolls').toBeGreaterThan(fit.metrics.clientHeight);
}

async function expectButtonsInView(fit: OpenDialog): Promise<void> {
  await expect(fit.cancel).toBeInViewport({ ratio: 1 });
  await expect(fit.confirm).toBeInViewport({ ratio: 1 });
}

test('@dialog-fit 1440x900: the Delete Order dialog keeps the approved 140px top, centred on the whole window', async ({
  page,
}, testInfo) => {
  test.skip(isDevice(testInfo), DESKTOP_ONLY);
  const fit = await openDeleteOrder(page, { width: 1440, height: 900 });

  expectNear(topOf(fit), DESKTOP_TOP, 'dialog top');
  expectCentred(fit);
  await expectWholeWindow(fit);
  expectNoScrolling(fit);
});

test("@dialog-fit 1274x585 (the owner's window): the dialog moves up until Cancel and Delete Order are inside the window", async ({
  page,
}, testInfo) => {
  test.skip(isDevice(testInfo), DESKTOP_ONLY);
  const fit = await openDeleteOrder(page, { width: 1274, height: 585 });
  const height = fit.box.height;

  expect(height + 2 * DESKTOP_EDGE, "the owner's window fits the dialog without scrolling").toBeLessThanOrEqual(585);
  expectNear(topOf(fit), clamp(585 - DESKTOP_EDGE - height, DESKTOP_EDGE, DESKTOP_TOP), 'dialog top');
  expect(fit.box.y).toBeLessThan(DESKTOP_TOP);
  expect(fit.box.y + height).toBeLessThanOrEqual(585 - DESKTOP_EDGE + 1);
  await expectButtonsInView(fit);
  expectNoScrolling(fit);
  expectCentred(fit);
});

test('@dialog-fit 1280x420 by mouse: the dialog sits 16px down and the wheel scrolls the backdrop to its buttons', async ({
  page,
}, testInfo) => {
  test.skip(isDevice(testInfo), DESKTOP_ONLY);
  const fit = await openDeleteOrder(page, { width: 1280, height: 420 });

  expectNear(topOf(fit), DESKTOP_EDGE, 'dialog top');
  expectScrolling(fit);
  await wheelOverDialog(page, fit);
  await expectButtonsInView(fit);
  await expectWholeWindow(fit);
  await expectNoAxeViolations(page);
});

test('@dialog-fit 1280x420 by keyboard: focus on Delete Order brings it fully into view', async ({
  page,
}, testInfo) => {
  test.skip(isDevice(testInfo), DESKTOP_ONLY);
  const fit = await openDeleteOrder(page, { width: 1280, height: 420 });
  await expect(fit.dialog.getByRole('textbox')).toBeFocused();

  await page.keyboard.type(ORDER);
  for (let presses = 0; presses < 4 && !(await page.evaluate<boolean>(CONFIRM_FOCUSED)); presses += 1) {
    await page.keyboard.press('Tab');
  }

  await expect(fit.confirm).toBeFocused();
  await expect(fit.confirm).toBeInViewport({ ratio: 1 });
});

test('@dialog-fit 412x839 phone page: the sheet keeps the approved 96px top, full width, nothing scrolls', async ({
  page,
}, testInfo) => {
  test.skip(isDevice(testInfo), DESKTOP_ONLY);
  const fit = await openDeleteOrder(page, { width: 412, height: 839 });

  expectNear(topOf(fit), clamp(839 - fit.box.height, PHONE_EDGE, PHONE_TOP), 'sheet top');
  expectNear(topOf(fit), PHONE_TOP, 'sheet top');
  expectFullWidthSheet(fit);
  expectNoScrolling(fit);
});

test('@dialog-fit 393x659 phone page: the sheet moves up until both buttons are inside the window', async ({
  page,
}, testInfo) => {
  test.skip(isDevice(testInfo), DESKTOP_ONLY);
  const fit = await openDeleteOrder(page, { width: 393, height: 659 });

  expectNear(topOf(fit), clamp(659 - fit.box.height, PHONE_EDGE, PHONE_TOP), 'sheet top');
  expectFullWidthSheet(fit);
  await expectButtonsInView(fit);
  expectNoScrolling(fit);
});

test('@dialog-fit 320x568 phone page: the sheet starts at the top and the wheel scrolls the backdrop to its buttons', async ({
  page,
}, testInfo) => {
  test.skip(isDevice(testInfo), DESKTOP_ONLY);
  const fit = await openDeleteOrder(page, { width: 320, height: 568 });

  expectNear(topOf(fit), clamp(568 - fit.box.height, PHONE_EDGE, PHONE_TOP), 'sheet top');
  expectFullWidthSheet(fit);
  expectScrolling(fit);
  await wheelOverDialog(page, fit);
  await expectButtonsInView(fit);
});

test("@dialog-fit on the phone's own screen: the sheet sits 96px down, moves up, or the backdrop scrolls to its buttons", async ({
  page,
}, testInfo) => {
  test.skip(!isDevice(testInfo), DEVICE_ONLY);
  const fit = await openDeleteOrder(page);
  const { height } = fit.viewport;

  expectNear(topOf(fit), clamp(height - fit.box.height, PHONE_EDGE, PHONE_TOP), 'sheet top');
  expectFullWidthSheet(fit);
  if (fit.box.height > height) {
    expectScrolling(fit);
    await fit.confirm.scrollIntoViewIfNeeded();
  } else {
    expectNoScrolling(fit);
  }
  await expectButtonsInView(fit);
});

test('@dialog-fit 1440x900: a left click on the dark area above the dialog closes it; a middle or a right press there does not', async ({
  page,
}, testInfo) => {
  test.skip(isDevice(testInfo), DESKTOP_ONLY);
  const fit = await openDeleteOrder(page, { width: 1440, height: 900 });

  const field = fit.dialog.getByRole('textbox');
  await expect(field, 'the field has the focus on open').toBeFocused();

  await page.mouse.click(720, 70, { button: 'middle' });
  await waitForFramesAndTask(page);
  await expect(fit.dialog, 'after a middle press').toBeVisible();
  await expect(field, 'after a middle press').toBeFocused();
  await page.mouse.click(720, 70, { button: 'right' });
  await waitForFramesAndTask(page);
  await expect(fit.dialog, 'after a right press').toBeVisible();
  await expect(field, 'after a right press').toBeFocused();

  await page.mouse.click(720, 70);
  await expect(fit.dialog).toHaveCount(0);
  await expect(
    page.locator('[data-case="confirm-delete-order"]').getByRole('button', { name: 'Open Delete Order' }),
  ).toBeVisible();
});

test('@dialog-fit 1280x420: after the wheel scrolls the backdrop to the buttons, a left click on the dark area beside the dialog still closes it', async ({
  page,
}, testInfo) => {
  test.skip(isDevice(testInfo), DESKTOP_ONLY);
  const fit = await openDeleteOrder(page, { width: 1280, height: 420 });

  await wheelOverDialog(page, fit);
  await expectButtonsInView(fit);
  await page.mouse.click(20, 210);

  await expect(fit.dialog).toHaveCount(0);
});

test("@dialog-fit on the phone's own screen: a click on the dark area above the sheet closes it", async ({
  page,
}, testInfo) => {
  test.skip(!isDevice(testInfo), DEVICE_ONLY);
  const fit = await openDeleteOrder(page);
  expect(fit.box.y, 'there is dark area above the sheet').toBeGreaterThanOrEqual(16);

  await page.mouse.click(fit.viewport.width / 2, fit.box.y / 2);

  await expect(fit.dialog).toHaveCount(0);
});

/**
 * Types the order number, wheels the backdrop to the buttons, then presses the dark area beside the dialog with the given
 * button. The dialog stays open, the caret stays after the order number in the confirm field, and the backdrop's
 * scrollTop is strictly what it was (review WR-01, plan 02-43).
 */
async function expectScrolledPressKept(
  page: Page,
  testInfo: TestInfo,
  press: { readonly button: 'middle' | 'right' },
): Promise<void> {
  const { button } = press;
  const fit = await openDeleteOrder(page, { width: 1280, height: 420 });
  const field = fit.dialog.getByRole('textbox');
  await expect(field).toBeFocused();
  await page.keyboard.type(ORDER);
  await wheelOverDialog(page, fit);
  await expectButtonsInView(fit);
  const before = await waitForSettledScroll(page);
  expect(before, 'the wheel scrolled the backdrop').toBeGreaterThan(0);

  await page.mouse.click(20, 210, press);
  await waitForFramesAndTask(page);

  const after = (await readRegion(page)).scrollTop;
  const caret = await readCaret(page);
  testInfo.annotations.push({
    type: 'dialog-focus',
    description: `${testInfo.project.name} ${button} press: scrollTop ${String(before)} -> ${String(after)}, caret ${JSON.stringify(caret)}`,
  });
  await expect(fit.dialog).toBeVisible();
  await expect(field).toBeFocused();
  await expect(field).toHaveValue(ORDER);
  expect(await readCaret(page)).toEqual({ start: 13, end: 13 });
  // Known limit of Firefox, scoped to the middle press only: Firefox's own middle-button scroll moves the backdrop about
  // 22 ms after the mouseup (scrollTop 105 -> 4 -> 0). It is not caused by a focus() call (the trap's only call uses
  // preventScroll, and scrollTop stayed 105 through it); the dialog stays open and the field keeps its focus, value and
  // caret, all asserted above. Owner decision 2026-10-14, plan 02-43. Every other press and project asserts it.
  const firefoxMiddleScroll = button === 'middle' && testInfo.project.name === 'firefox';
  if (!firefoxMiddleScroll) {
    expect(after, `the ${button} press did not move the backdrop`).toBe(before);
  }
}

test('@dialog-fit 1280x420 scrolled: a right press on the dark area keeps the dialog open, the caret in the confirm field and the backdrop where it was', async ({
  page,
}, testInfo) => {
  test.skip(isDevice(testInfo), DESKTOP_ONLY);
  await expectScrolledPressKept(page, testInfo, { button: 'right' });
});

test('@dialog-fit 1280x420 scrolled: a middle press on the dark area keeps the dialog open, the caret in the confirm field and the backdrop where it was', async ({
  page,
}, testInfo) => {
  test.skip(isDevice(testInfo), DESKTOP_ONLY);
  await expectScrolledPressKept(page, testInfo, { button: 'middle' });
});

test("@dialog-fit on the phone's own screen: a right press on the dark area above the sheet keeps it open with the caret in the confirm field", async ({
  page,
}, testInfo) => {
  test.skip(!isDevice(testInfo), DEVICE_ONLY);
  const fit = await openDeleteOrder(page);
  expect(fit.box.y, 'there is dark area above the sheet').toBeGreaterThanOrEqual(16);
  const field = fit.dialog.getByRole('textbox');
  await expect(field).toBeFocused();
  await page.keyboard.type(ORDER);
  const before = (await readRegion(page)).scrollTop;

  await page.mouse.click(fit.viewport.width / 2, fit.box.y / 2, { button: 'right' });
  await waitForFramesAndTask(page);

  const after = (await readRegion(page)).scrollTop;
  testInfo.annotations.push({
    type: 'dialog-focus',
    description: `${testInfo.project.name} right press above the sheet: scrollTop ${String(before)} -> ${String(after)}`,
  });
  await expect(fit.dialog).toBeVisible();
  await expect(field).toBeFocused();
  await expect(field).toHaveValue(ORDER);
  expect(await readCaret(page)).toEqual({ start: 13, end: 13 });
  expect(after, 'the right press did not move the backdrop').toBe(before);
});

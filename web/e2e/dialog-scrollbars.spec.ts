// The Delete Order dialog's backdrop with real scrollbars (owner ruling D-42, UAT G-2-199, plan 02-42; review WR-01 and
// WR-02). Headless Chromium starts with --hide-scrollbars, so the other projects never press a real scrollbar. This spec
// runs only in the two Chromium projects that show them again (playwright.config.ts):
//   - chromium-classic-scrollbars: classic scrollbars that take about 15px of the window (Chrome on Windows, the
//     owner's setup);
//   - chromium-overlay-scrollbars: overlay scrollbars that take no space (macOS with a trackpad, ChromeOS).
// At 1280x420 the Delete Order dialog is taller than the window, so its backdrop (the Overlay region) scrolls. D-42:
// pressing or dragging the backdrop's scrollbar scrolls it and never closes the dialog, so the typed order number is
// never lost. A middle or a right press on the dark area does not close it either, and a left click there still does.
// From a scrolled backdrop, a press that does not close leaves the caret in the confirm field and the backdrop where it
// was (review WR-01/WR-02, plan 02-43).
import type { Page, TestInfo } from '@playwright/test';
import { expect, test } from './fixtures.ts';
import {
  ORDER,
  openDeleteOrder,
  readCaret,
  readRegion,
  waitForFramesAndTask,
  waitForSettledScroll,
  wheelOverDialog,
  type OpenDialog,
} from './deleteOrderDialog.ts';

type ScrollbarMode = 'classic' | 'overlay';

const WINDOW = { width: 1280, height: 420 } as const;

const scrollbarMode = (testInfo: TestInfo): ScrollbarMode =>
  testInfo.project.name === 'chromium-overlay-scrollbars' ? 'overlay' : 'classic';

/**
 * The project really shows the scrollbars it claims: the backdrop overflows, and a classic scrollbar narrows its client
 * area while an overlay one leaves the whole window width.
 */
function expectRealScrollbars(fit: OpenDialog, mode: ScrollbarMode): void {
  expect(fit.metrics.scrollHeight, 'the backdrop scrolls').toBeGreaterThan(fit.metrics.clientHeight);
  if (mode === 'overlay') {
    expect(fit.metrics.clientWidth, 'overlay scrollbars take no space').toBe(WINDOW.width);
  } else {
    expect(fit.metrics.clientWidth, 'classic scrollbars take space').toBeLessThan(WINDOW.width);
  }
}

/** The wheel turn that shows the backdrop's scrollbar before it is pressed (the thumb still covers y 120). */
const REVEAL_WHEEL = 30;

/**
 * Brings the backdrop's scrollbar into view under the pointer at (x, y), as a person sees it before grabbing it, and
 * resolves once the backdrop has stopped scrolling. Overlay scrollbars are hidden until the backdrop scrolls (hovering
 * at the edge does not show them every time): a press before they show is a press on the dark area, where nothing is
 * drawn, and that rightly closes the dialog. So the pointer rests on the edge and the wheel turns a little; a scroll
 * always shows them and the resting pointer keeps them shown. Classic scrollbars are always shown; the same steps do no
 * harm there.
 */
async function revealScrollbar(page: Page, x: number, y: number): Promise<void> {
  await page.mouse.move(x - 40, y);
  await page.mouse.move(x, y, { steps: 5 });
  await page.mouse.wheel(0, REVEAL_WHEEL);
  let last = Number.NaN;
  await expect
    .poll(
      async () => {
        const now = (await readRegion(page)).scrollTop;
        const settled = now > 0 && now === last;
        last = now;
        return settled;
      },
      { message: 'the wheel scrolled the backdrop and it settled', intervals: [100] },
    )
    .toBe(true);
}

/** Opens Delete Order at 1280x420, checks the scrollbar mode is real and types the order number. */
async function openTyped(page: Page, mode: ScrollbarMode): Promise<OpenDialog> {
  const fit = await openDeleteOrder(page, WINDOW);
  expectRealScrollbars(fit, mode);
  const field = fit.dialog.getByRole('textbox');
  await expect(field).toBeFocused();
  await page.keyboard.type(ORDER);
  return fit;
}

/**
 * The dialog is still open and the confirm field kept what the person typed: its value, the focus and the caret after
 * the last character. Waits first, so a focus move or a scroll that happens a task after the press is seen.
 */
async function expectKept(fit: OpenDialog, page: Page): Promise<void> {
  await waitForFramesAndTask(page);
  await expect(fit.dialog).toBeVisible();
  const field = fit.dialog.getByRole('textbox');
  await expect(field).toHaveValue(ORDER);
  await expect(field).toBeFocused();
  expect(await readCaret(page)).toEqual({ start: 13, end: 13 });
}

test("@dialog-fit scrollbars 1280x420: dragging the backdrop's scrollbar scrolls it and keeps the Delete Order dialog open with the typed order number", async ({
  page,
}, testInfo) => {
  const mode = scrollbarMode(testInfo);
  const fit = await openDeleteOrder(page, WINDOW);
  expectRealScrollbars(fit, mode);
  const field = fit.dialog.getByRole('textbox');
  await expect(field).toBeFocused();
  await page.keyboard.type(ORDER);
  await revealScrollbar(page, WINDOW.width - 4, 120);
  const before = (await readRegion(page)).scrollTop;

  await page.mouse.down();
  await waitForFramesAndTask(page);
  await expect(field, 'the press on the scrollbar kept the focus in the field').toBeFocused();
  expect((await readRegion(page)).scrollTop, 'the press did not move the backdrop').toBe(before);
  await page.mouse.move(WINDOW.width - 4, 300, { steps: 10 });
  await page.mouse.up();

  await expectKept(fit, page);
  const after = (await readRegion(page)).scrollTop;
  testInfo.annotations.push({
    type: 'dialog-scrollbars',
    description: `${testInfo.project.name}: clientWidth ${String(fit.metrics.clientWidth)}/${String(WINDOW.width)}, scrollTop ${String(before)} -> ${String(after)}`,
  });
  expect(after, 'the drag scrolled the backdrop').toBeGreaterThan(before);
});

test("@dialog-fit scrollbars 1280x420: a press on the backdrop's scrollbar without moving keeps the dialog open", async ({
  page,
}, testInfo) => {
  const mode = scrollbarMode(testInfo);
  const fit = await openTyped(page, mode);

  await revealScrollbar(page, WINDOW.width - 4, 120);
  const before = (await readRegion(page)).scrollTop;
  await page.mouse.down();
  await page.mouse.up();
  await expectKept(fit, page);
  expect((await readRegion(page)).scrollTop, 'a press on the thumb did not move the backdrop').toBe(before);

  if (mode === 'classic') {
    // The first scrollbar column: the client area ends just left of it. On Windows-style scrollbars that column can be
    // track, where a press legitimately pages the backdrop, so its scrollTop is recorded, not asserted.
    await page.mouse.click(fit.metrics.clientWidth, 120);
    await expectKept(fit, page);
    testInfo.annotations.push({
      type: 'dialog-scrollbars',
      description: `${testInfo.project.name}: first scrollbar column press, scrollTop ${String(before)} -> ${String((await readRegion(page)).scrollTop)}`,
    });
  }
});

test('@dialog-fit scrollbars 1280x420: a middle press on the dark area keeps the dialog open', async ({
  page,
}, testInfo) => {
  // Its own test: on the scrolling backdrop the middle press may start autoscroll. It starts from a scrolled backdrop.
  const fit = await openTyped(page, scrollbarMode(testInfo));
  await wheelOverDialog(page, fit);
  const before = await waitForSettledScroll(page);

  await page.mouse.click(20, 60, { button: 'middle' });

  await expectKept(fit, page);
  expect((await readRegion(page)).scrollTop, 'the middle press did not move the backdrop').toBe(before);
});

test('@dialog-fit scrollbars 1280x420: a right press on the dark area keeps the dialog open, and a left click there closes it', async ({
  page,
}, testInfo) => {
  const mode = scrollbarMode(testInfo);
  const fit = await openTyped(page, mode);
  await wheelOverDialog(page, fit);
  const before = await waitForSettledScroll(page);

  await page.mouse.click(20, 60, { button: 'right' });
  await expectKept(fit, page);
  expect((await readRegion(page)).scrollTop, 'the right press did not move the backdrop').toBe(before);

  // Classic: the last scrim column, next to the scrollbar.
  await page.mouse.click(mode === 'classic' ? fit.metrics.clientWidth - 1 : 20, 60);
  await expect(fit.dialog).toHaveCount(0);
});

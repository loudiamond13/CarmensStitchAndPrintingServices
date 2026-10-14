// The Delete Order dialog's backdrop with real scrollbars (owner ruling D-42, UAT G-2-199, plan 02-42; review WR-01 and
// WR-02). Headless Chromium starts with --hide-scrollbars, so the other projects never press a real scrollbar. This spec
// runs only in the two Chromium projects that show them again (playwright.config.ts):
//   - chromium-classic-scrollbars: classic scrollbars that take about 15px of the window (Chrome on Windows, the
//     owner's setup);
//   - chromium-overlay-scrollbars: overlay scrollbars that take no space (macOS with a trackpad, ChromeOS).
// At 1280x420 the Delete Order dialog is taller than the window, so its backdrop (the Overlay region) scrolls. D-42:
// pressing or dragging the backdrop's scrollbar scrolls it and never closes the dialog, so the typed order number is
// never lost.
import type { TestInfo } from '@playwright/test';
import { expect, test } from './fixtures.ts';
import { ORDER, openDeleteOrder, readRegion, type OpenDialog } from './deleteOrderDialog.ts';

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

test("@dialog-fit scrollbars 1280x420: dragging the backdrop's scrollbar scrolls it and keeps the Delete Order dialog open with the typed order number", async ({
  page,
}, testInfo) => {
  const mode = scrollbarMode(testInfo);
  const fit = await openDeleteOrder(page, WINDOW);
  expectRealScrollbars(fit, mode);
  const field = fit.dialog.getByRole('textbox');
  await expect(field).toBeFocused();
  await page.keyboard.type(ORDER);
  const before = (await readRegion(page)).scrollTop;

  await page.mouse.move(WINDOW.width - 4, 120);
  await page.mouse.down();
  await page.mouse.move(WINDOW.width - 4, 300, { steps: 10 });
  await page.mouse.up();

  await expect(fit.dialog).toBeVisible();
  await expect(field).toHaveValue('ORD-2026-0148');
  const after = (await readRegion(page)).scrollTop;
  testInfo.annotations.push({
    type: 'dialog-scrollbars',
    description: `${testInfo.project.name}: clientWidth ${String(fit.metrics.clientWidth)}/${String(WINDOW.width)}, scrollTop ${String(before)} -> ${String(after)}`,
  });
  expect(after, 'the drag scrolled the backdrop').toBeGreaterThan(before);
});

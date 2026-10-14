// The Delete Order dialog helpers shared by dialog-fit.spec.ts and dialog-scrollbars.spec.ts (plans 02-41 and 02-42,
// owner ruling D-42): open /dev/components at a window size, open the Delete Order dialog in its Overlay region (App. C
// `.s-overlay`), wait for its entry animation and measure the dialog and the region. Every measurement waits for the
// animations to finish: the dialog's 0.2s rise moves its box. Page scripts are strings: the e2e TypeScript program has
// no DOM types.
import type { Locator, Page } from '@playwright/test';
import { expect, test } from './fixtures.ts';

export const DIALOG_NAME = 'Delete order ORD-2026-0148?';
export const ORDER = 'ORD-2026-0148';

/** The Overlay region that holds the Delete Order dialog. */
const REGION = `[...document.querySelectorAll('[data-ui="s-overlay"]')].find((region) => [...region.querySelectorAll('[role="dialog"]')].some((dialog) => document.getElementById(dialog.getAttribute('aria-labelledby') ?? '')?.textContent === ${JSON.stringify(DIALOG_NAME)}))`;

/** Resolves once every animation inside the region (the overlay fade, the modal rise) has finished. */
const SETTLE = `(async () => {
  const region = ${REGION};
  await Promise.all(region.getAnimations({ subtree: true }).map((animation) => animation.finished));
  return true;
})()`;

export interface RegionMetrics {
  readonly scrollHeight: number;
  readonly scrollTop: number;
  readonly clientHeight: number;
  readonly clientWidth: number;
  readonly overflowY: string;
}

const READ_REGION = `(() => {
  const region = ${REGION};
  return {
    scrollHeight: region.scrollHeight,
    scrollTop: region.scrollTop,
    clientHeight: region.clientHeight,
    clientWidth: region.clientWidth,
    overflowY: getComputedStyle(region).overflowY,
  };
})()`;

export interface Box {
  readonly x: number;
  readonly y: number;
  readonly width: number;
  readonly height: number;
}

export interface OpenDialog {
  readonly dialog: Locator;
  readonly region: Locator;
  readonly cancel: Locator;
  readonly confirm: Locator;
  /** The dialog panel (the phone sheet on phone pages). */
  readonly box: Box;
  readonly metrics: RegionMetrics;
  readonly viewport: { readonly width: number; readonly height: number };
}

export async function boxOf(locator: Locator, name: string): Promise<Box> {
  const box = await locator.boundingBox();
  if (box === null) {
    throw new Error(`Expected ${name} to have a box.`);
  }
  return box;
}

/** The region's scroll position and size, read now (it changes when the backdrop scrolls). */
export async function readRegion(page: Page): Promise<RegionMetrics> {
  return page.evaluate<RegionMetrics>(READ_REGION);
}

/** Opens /dev/components at the given window size (or the project's own), opens Delete Order and measures it. */
export async function openDeleteOrder(
  page: Page,
  size?: { readonly width: number; readonly height: number },
): Promise<OpenDialog> {
  test.setTimeout(120_000);
  if (size !== undefined) {
    await page.setViewportSize(size);
  }
  const response = await page.goto('/dev/components');
  expect(response?.status()).toBe(200);
  await expect(page.locator('h1')).toHaveText('Component Showcase');

  await page.locator('[data-case="confirm-delete-order"]').getByRole('button', { name: 'Open Delete Order' }).click();
  const dialog = page.getByRole('dialog', { name: DIALOG_NAME });
  await expect(dialog).toBeVisible();
  await page.evaluate(SETTLE);

  const viewport = page.viewportSize();
  if (viewport === null) {
    throw new Error('Expected a viewport size.');
  }
  const fit: OpenDialog = {
    dialog,
    region: page.locator('[data-ui="s-overlay"]').filter({ has: dialog }),
    cancel: dialog.getByRole('button', { name: 'Cancel' }),
    confirm: dialog.getByRole('button', { name: 'Delete Order' }),
    box: await boxOf(dialog, 'the dialog'),
    metrics: await readRegion(page),
    viewport,
  };
  // The measured place, in the report (plan 02-41 records the post-fix tops per window).
  test.info().annotations.push({
    type: 'dialog-fit',
    description: `${String(viewport.width)}x${String(viewport.height)}: top ${String(topOf(fit))}, height ${String(fit.box.height)}, region ${String(fit.metrics.scrollHeight)}/${String(fit.metrics.clientHeight)} ${fit.metrics.overflowY}`,
  });
  return fit;
}

/**
 * Where the layout puts the dialog: its top with the backdrop scrolled back to the start. Opening it moves focus to its
 * first field, and on a window shorter than the dialog the browser may scroll the backdrop to show that field.
 */
export const topOf = (fit: OpenDialog): number => fit.box.y + fit.metrics.scrollTop;

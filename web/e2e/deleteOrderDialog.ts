// The Delete Order dialog helpers shared by dialog-fit.spec.ts and dialog-scrollbars.spec.ts (plans 02-41, 02-42 and
// 02-43, owner ruling D-42): open /dev/components at a window size, open the Delete Order dialog in its Overlay region (App. C
// `.s-overlay`), wait for its entry animation and measure the dialog and the region. Every measurement waits for the
// animations to finish: the dialog's 0.2s rise moves its box. Page scripts that take no data are strings, because the
// e2e TypeScript program has no DOM types; the one that needs the dialog's name is a function that gets it as an argument
// (CodeQL js/bad-code-sanitization, plan 14-11). Plan 02-43 adds the
// helpers that prove a press which does not close the dialog leaves the caret in the confirm field and the scrolled
// backdrop where it was (review WR-01): waitForFramesAndTask, waitForSettledScroll and readCaret.
import type { Locator, Page } from '@playwright/test';
import { expect, test } from './fixtures.ts';

export const DIALOG_NAME = 'Delete order ORD-2026-0148?';
export const ORDER = 'ORD-2026-0148';

export interface RegionMetrics {
  readonly scrollHeight: number;
  readonly scrollTop: number;
  readonly clientHeight: number;
  readonly clientWidth: number;
  readonly overflowY: string;
}

// The page function below reads the DOM through `globalThis`, typed by these shapes (the e2e program has no DOM
// types). The dialog's name reaches it as the `evaluate` argument, never as code text.
interface DialogNode {
  getAttribute(name: string): string | null;
}

interface RegionNode {
  readonly scrollHeight: number;
  readonly scrollTop: number;
  readonly clientHeight: number;
  readonly clientWidth: number;
  querySelectorAll(selector: string): ArrayLike<DialogNode>;
  getAnimations(options: { readonly subtree: boolean }): readonly { readonly finished: Promise<unknown> }[];
}

interface PageScope {
  readonly document: {
    querySelectorAll(selector: string): ArrayLike<RegionNode>;
    getElementById(id: string): { readonly textContent: string | null } | null;
  };
  getComputedStyle(node: RegionNode): { readonly overflowY: string };
}

interface RegionRequest {
  readonly name: string;
  /** Wait for every animation inside the region (the overlay fade, the modal rise) to finish before measuring. */
  readonly settle: boolean;
}

/**
 * The Overlay region's scroll position, size and overflow, read in the page. It is serialised into the page on its own,
 * so it holds the one region lookup both callers need: with `settle` it first waits for the region's animations.
 */
async function readOverlayRegion(request: RegionRequest): Promise<RegionMetrics> {
  const scope = globalThis as unknown as PageScope;
  const region = Array.from(scope.document.querySelectorAll('[data-ui="s-overlay"]')).find((candidate) =>
    Array.from(candidate.querySelectorAll('[role="dialog"]')).some(
      (dialog) =>
        scope.document.getElementById(dialog.getAttribute('aria-labelledby') ?? '')?.textContent === request.name,
    ),
  );
  if (region === undefined) {
    throw new Error(`No Overlay region holds the dialog "${request.name}".`);
  }
  if (request.settle) {
    await Promise.all(region.getAnimations({ subtree: true }).map((animation) => animation.finished));
  }
  return {
    scrollHeight: region.scrollHeight,
    scrollTop: region.scrollTop,
    clientHeight: region.clientHeight,
    clientWidth: region.clientWidth,
    overflowY: scope.getComputedStyle(region).overflowY,
  };
}

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
  return page.evaluate<RegionMetrics, RegionRequest>(readOverlayRegion, { name: DIALOG_NAME, settle: false });
}

/**
 * Resolves after two animation frames and then a 0 ms task. WebKit applied a focus reveal one task after the focus move
 * (the 02-42 probe), so this window lets any such scroll happen before scrollTop or the focus is read.
 */
export async function waitForFramesAndTask(page: Page): Promise<void> {
  await page.evaluate<boolean>(`(async () => {
    await new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)));
    await new Promise((resolve) => setTimeout(resolve, 0));
    return true;
  })()`);
}

/**
 * Polls the region until two reads in a row give the same scrollTop greater than 0 (the wheel has scrolled the backdrop
 * and it stopped), and returns that value.
 */
export async function waitForSettledScroll(page: Page): Promise<number> {
  let last = Number.NaN;
  let settledAt = 0;
  await expect
    .poll(
      async () => {
        const now = (await readRegion(page)).scrollTop;
        const settled = now > 0 && now === last;
        last = now;
        settledAt = now;
        return settled;
      },
      { message: 'the backdrop scrolled and settled', intervals: [100] },
    )
    .toBe(true);
  return settledAt;
}

/** The caret of the focused input (selectionStart and selectionEnd), or null when no input has the focus. */
export async function readCaret(
  page: Page,
): Promise<{ readonly start: number | null; readonly end: number | null } | null> {
  return page.evaluate<{ readonly start: number | null; readonly end: number | null } | null>(`(() => {
    const active = document.activeElement;
    return active instanceof HTMLInputElement ? { start: active.selectionStart, end: active.selectionEnd } : null;
  })()`);
}

/** Turns the mouse wheel over the dialog: the scrolling backdrop takes it. */
export async function wheelOverDialog(page: Page, fit: OpenDialog): Promise<void> {
  const visibleBottom = Math.min(fit.box.y + fit.box.height, fit.viewport.height);
  await page.mouse.move(fit.box.x + fit.box.width / 2, (fit.box.y + visibleBottom) / 2);
  await page.mouse.wheel(0, 1000);
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
  // The showcase draws about 250 cases in one commit, which WebKit takes 6 to 10 s to show, longer than the 5 s default.
  await expect(page.locator('h1')).toHaveText('Component Showcase', { timeout: 30_000 });

  await page.locator('[data-case="confirm-delete-order"]').getByRole('button', { name: 'Open Delete Order' }).click();
  const dialog = page.getByRole('dialog', { name: DIALOG_NAME });
  await expect(dialog).toBeVisible();
  await page.evaluate<RegionMetrics, RegionRequest>(readOverlayRegion, { name: DIALOG_NAME, settle: true });

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

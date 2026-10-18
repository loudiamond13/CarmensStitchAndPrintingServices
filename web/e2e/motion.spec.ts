// Dialog motion (owner decisions D-38 and D-39, plan 05-02) on the real host, in every project. The Add Payment dialog
// and the Add User slide-over of /dev/components, which pass `open` to Modal, so the close animation plays end to end:
//   - on Cancel the dialog stays attached for its exit animation with data-state="closed" and the exit keyframes running,
//     while focus is already back on the button that opened it (the focus trap, inert page and scroll lock are released
//     at once); then it leaves the DOM;
//   - under prefers-reduced-motion nothing moves: no animation runs and the dialog leaves the DOM at once;
//   - the layout does not shift while a dialog opens and closes (cumulative layout shift under 0.05, Chromium only: the
//     other engines do not report layout shifts).
// The first sample is taken inside one page task, 40 ms after the click, because a Playwright round trip alone can take
// longer than the 150 ms exit animation. Page scripts are strings: the e2e TypeScript program has no DOM types.
import type { Page } from '@playwright/test';
import { expect, test } from './fixtures.ts';

const DIALOGS = [
  { trigger: 'Open Add Payment', name: 'Add Payment', exit: 'csp-rise-out' },
  { trigger: 'Open Add User', name: 'Add User', exit: 'csp-slide-out' },
] as const;

/** Longer than the 300 ms presence fallback, so a closed dialog has certainly left. */
const SETTLED_MS = 450;

interface Sample {
  readonly attached: boolean;
  readonly state: string | null;
  readonly animationName: string;
  readonly focusedText: string;
  readonly pageInert: boolean;
  readonly scrollLocked: boolean;
}

async function openShowcase(page: Page): Promise<void> {
  test.setTimeout(120_000);
  const response = await page.goto('/dev/components');
  expect(response?.status()).toBe(200);
  await expect(page.locator('h1')).toHaveText('Component Showcase');
}

/** Opens by keyboard: WebKit does not focus a button on a mouse click, and the trap returns focus to what had it. */
async function openFromTrigger(page: Page, trigger: string): Promise<void> {
  await page.getByRole('button', { name: trigger }).focus();
  await page.keyboard.press('Enter');
}

/** The animation names of the open dialog and of the scrim around it. */
function animationNames(page: Page): Promise<{ dialog: string; scrim: string }> {
  return page.evaluate(`(() => {
    const dialog = document.querySelector('[role="dialog"]');
    return {
      dialog: getComputedStyle(dialog).animationName,
      scrim: getComputedStyle(dialog.parentElement).animationName,
    };
  })()`);
}

/** Opens the dialog from its trigger and waits until it is fully open. */
async function openDialog(page: Page, trigger: string, name: string): Promise<void> {
  await openFromTrigger(page, trigger);
  const dialog = page.getByRole('dialog', { name });
  await expect(dialog).toBeVisible();
  await expect(dialog).toHaveAttribute('data-state', 'open');
  // The entry animation has finished, so the sample below is about the exit only.
  await page.waitForTimeout(300);
}

/** Presses Cancel in the open dialog and describes the dialog `delay` ms later, inside one page task. */
function cancelAndSample(page: Page, delay: number): Promise<Sample> {
  return page.evaluate(`new Promise((resolve) => {
    const dialog = document.querySelector('[role="dialog"]');
    const cancel = [...dialog.querySelectorAll('button')].find((button) => button.textContent.trim() === 'Cancel');
    cancel.click();
    setTimeout(() => {
      resolve({
        attached: dialog.isConnected,
        state: dialog.getAttribute('data-state'),
        animationName: dialog.isConnected ? getComputedStyle(dialog).animationName : '',
        focusedText: document.activeElement ? document.activeElement.textContent.trim() : '',
        pageInert: document.querySelector('main') !== null && document.querySelector('main').closest('[inert]') !== null,
        scrollLocked: document.body.classList.contains('overflow-hidden'),
      });
    }, ${String(delay)});
  })`);
}

for (const { trigger, name, exit } of DIALOGS) {
  test(`@motion dialog: ${name} plays its exit, with focus back on its button at once, then leaves the DOM`, async ({
    page,
  }) => {
    await openShowcase(page);
    await openDialog(page, trigger, name);

    const early = await cancelAndSample(page, 40);

    expect(early.attached, 'still attached while the exit plays').toBe(true);
    expect(early.state).toBe('closed');
    expect(early.animationName).toBe(exit);
    expect(early.focusedText, 'focus is back on the trigger').toBe(trigger);
    expect(early.pageInert, 'the page is live again').toBe(false);
    expect(early.scrollLocked, 'body scroll is released').toBe(false);

    await page.waitForTimeout(SETTLED_MS);
    await expect(page.getByRole('dialog', { name })).toHaveCount(0);
    await expect(page.getByRole('button', { name: trigger })).toBeFocused();
  });

  test(`@motion reduced: ${name} does not move under reduced motion and leaves the DOM at once`, async ({ page }) => {
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await openShowcase(page);
    await openFromTrigger(page, trigger);
    const dialog = page.getByRole('dialog', { name });
    await expect(dialog).toBeVisible();
    expect(await animationNames(page)).toEqual({ dialog: 'none', scrim: 'none' });

    const early = await cancelAndSample(page, 40);

    expect(early.attached, JSON.stringify(early)).toBe(false);
    await expect(dialog).toHaveCount(0);
    await expect(page.getByRole('button', { name: trigger })).toBeFocused();
  });
}

test('@motion cls: opening and closing the dialogs shifts no layout', async ({ page }) => {
  await page.addInitScript(`
    window.__cspsLayoutShift = 0;
    window.__cspsLayoutShiftSupported = PerformanceObserver.supportedEntryTypes.includes('layout-shift');
    if (window.__cspsLayoutShiftSupported) {
      new PerformanceObserver((list) => {
        for (const entry of list.getEntries()) {
          if (!entry.hadRecentInput) {
            window.__cspsLayoutShift += entry.value;
          }
        }
      }).observe({ type: 'layout-shift', buffered: true });
    }
  `);
  await openShowcase(page);
  test.skip(
    !(await page.evaluate('window.__cspsLayoutShiftSupported')),
    'This engine does not report layout shifts; Chromium proves it.',
  );
  const before = await page.evaluate<number>('window.__cspsLayoutShift');

  for (const { trigger, name } of DIALOGS) {
    await openDialog(page, trigger, name);
    await cancelAndSample(page, 0);
    await page.waitForTimeout(SETTLED_MS);
    await expect(page.getByRole('dialog', { name })).toHaveCount(0);
  }

  const after = await page.evaluate<number>('window.__cspsLayoutShift');
  expect(after - before, 'layout shift added by opening and closing').toBeLessThan(0.05);
});

// Dialog motion (owner decisions D-38 and D-39, plan 05-02) on the real host, in every project. The Add Payment dialog
// and the Add User slide-over of /dev/components, which pass `open` to Modal, so the close animation plays end to end:
//   - on Cancel the dialog stays attached for its exit animation with data-state="closed" and the exit keyframes running,
//     while focus is already back on the button that opened it (the focus trap, inert page and scroll lock are released
//     at once); then it leaves the DOM;
//   - under prefers-reduced-motion nothing moves: no animation runs and the dialog leaves the DOM at once;
//   - the layout does not shift while a dialog opens and closes (cumulative layout shift under 0.05, Chromium only: the
//     other engines do not report layout shifts).
// Plan 05-08 adds the phone navigation drawer (D-34) the same way, on a 390px-wide page where the Topbar shows its menu
// button: the panel slides in (csp-drawer-in), and on Esc it stays attached as data-state="closed" for its exit, then
// leaves; under reduced motion it leaves at once; the layout does not shift.
// The first sample is taken inside one page task, 40 ms after the click, because a Playwright round trip alone can take
// longer than the 150 ms exit animation. Page scripts are strings: the e2e TypeScript program has no DOM types.
import type { Page } from '@playwright/test';
import { signInAs } from './auth.ts';
import { expect, test } from './fixtures.ts';
import { createStaff } from './testing-api.ts';

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

// ── D-34: the phone navigation drawer ──

/** The phone page width of the drawer journeys (the approved phone frame). */
const PHONE = { width: 390, height: 844 } as const;

interface DrawerSample {
  readonly attached: boolean;
  readonly state: string | null;
  readonly layerState: string | null;
  readonly panelAnimation: string;
  readonly layerAnimation: string;
  readonly buttonName: string;
  readonly buttonExpanded: string | null;
}

async function openAdminOnPhone(page: Page): Promise<void> {
  test.setTimeout(120_000);
  await page.setViewportSize(PHONE);
  const response = await page.goto('/admin');
  expect(response?.status()).toBe(200);
  await expect(page.locator('h1')).toHaveText('Dashboard');
}

const DESCRIBE_DRAWER = `(() => {
  const panel = document.querySelector('[role="dialog"][aria-label="Navigation"]');
  const button = document.querySelector('button[aria-label$=" navigation"]');
  return {
    attached: panel !== null && panel.isConnected,
    state: panel === null ? null : panel.getAttribute('data-state'),
    layerState: panel === null ? null : panel.parentElement.getAttribute('data-state'),
    panelAnimation: panel === null ? '' : getComputedStyle(panel).animationName,
    layerAnimation: panel === null ? '' : getComputedStyle(panel.parentElement).animationName,
    buttonName: button === null ? '' : button.getAttribute('aria-label') ?? '',
    buttonExpanded: button === null ? null : button.getAttribute('aria-expanded'),
  };
})()`;

/** Taps the menu button and describes the drawer `delay` ms later, inside one page task. */
function openAndSample(page: Page, delay: number): Promise<DrawerSample> {
  return page.evaluate(`new Promise((resolve) => {
    document.querySelector('button[aria-label="Open navigation"]').click();
    setTimeout(() => resolve(${DESCRIBE_DRAWER}), ${String(delay)});
  })`);
}

/** Presses Esc and describes the drawer `delay` ms later, inside one page task. */
function escapeAndSample(page: Page, delay: number): Promise<DrawerSample> {
  return page.evaluate(`new Promise((resolve) => {
    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true, cancelable: true }));
    setTimeout(() => resolve(${DESCRIBE_DRAWER}), ${String(delay)});
  })`);
}

test('@motion drawer: slides in, plays its exit with the scrim fading, then leaves the DOM', async ({ page }) => {
  await openAdminOnPhone(page);
  const menu = page.getByRole('button', { name: 'Open navigation' });

  const opened = await openAndSample(page, 40);

  expect(opened.attached).toBe(true);
  expect(opened.state).toBe('open');
  expect(opened.panelAnimation).toBe('csp-drawer-in');
  expect(opened.layerAnimation).toBe('csp-fade');
  expect(opened.buttonName).toBe('Close navigation');
  expect(opened.buttonExpanded).toBe('true');
  // The entry animation has finished, so the sample below is about the exit only.
  await page.waitForTimeout(300);

  const early = await escapeAndSample(page, 40);

  expect(early.attached, 'still attached while the exit plays').toBe(true);
  expect(early.state).toBe('closed');
  expect(early.layerState).toBe('closed');
  expect(early.panelAnimation).toBe('csp-drawer-out');
  expect(early.layerAnimation).toBe('csp-fade-out');
  expect(early.buttonName).toBe('Open navigation');
  expect(early.buttonExpanded).toBe('false');

  await page.waitForTimeout(SETTLED_MS);
  await expect(page.getByRole('dialog', { name: 'Navigation' })).toHaveCount(0);
  await expect(menu).toBeFocused();
});

test('@motion drawer reduced: does not move under reduced motion and leaves the DOM at once', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await openAdminOnPhone(page);

  const opened = await openAndSample(page, 40);

  expect(opened.attached).toBe(true);
  expect(opened.panelAnimation).toBe('none');
  expect(opened.layerAnimation).toBe('none');

  const early = await escapeAndSample(page, 40);

  expect(early.attached, JSON.stringify(early)).toBe(false);
  await expect(page.getByRole('button', { name: 'Open navigation' })).toBeFocused();
});

test('@motion drawer cls: opening and closing the drawer shifts no layout', async ({ page }) => {
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
  await openAdminOnPhone(page);
  test.skip(
    !(await page.evaluate('window.__cspsLayoutShiftSupported')),
    'This engine does not report layout shifts; Chromium proves it.',
  );
  const before = await page.evaluate<number>('window.__cspsLayoutShift');

  await openAndSample(page, 300);
  await escapeAndSample(page, SETTLED_MS);

  const after = await page.evaluate<number>('window.__cspsLayoutShift');
  expect(after - before, 'layout shift added by opening and closing').toBeLessThan(0.05);
});

// ── D-35: the user menu ──

const MENU_VIEWPORTS = [
  { label: 'desktop', width: 1440, height: 900 },
  { label: 'phone', width: 390, height: 844 },
] as const;

interface MenuSample {
  readonly attached: boolean;
  readonly state: string | null;
  readonly animationName: string;
  readonly chevronTransform: string;
  readonly chevronRotate: string;
  readonly chevronDuration: string;
  readonly expanded: string | null;
}

const DESCRIBE_MENU = `(() => {
  const popover = document.querySelector('[role="menu"]');
  const button = document.querySelector('button[aria-haspopup="menu"]');
  const chevron = button.lastElementChild;
  return {
    attached: popover !== null && popover.isConnected,
    state: popover === null ? null : popover.getAttribute('data-state'),
    animationName: popover === null ? '' : getComputedStyle(popover).animationName,
    chevronTransform: getComputedStyle(chevron).transform,
    chevronRotate: getComputedStyle(chevron).rotate,
    chevronDuration: getComputedStyle(chevron).transitionDuration,
    expanded: button.getAttribute('aria-expanded'),
  };
})()`;

async function openAdminAt(page: Page, width: number, height: number): Promise<void> {
  test.setTimeout(120_000);
  await page.setViewportSize({ width, height });
  const response = await page.goto('/admin');
  expect(response?.status()).toBe(200);
  await expect(page.locator('h1')).toHaveText('Dashboard');
}

/** Clicks the user-menu button and describes the menu `delay` ms later, inside one page task. */
function openMenuAndSample(page: Page, delay: number): Promise<MenuSample> {
  return page.evaluate(`new Promise((resolve) => {
    document.querySelector('button[aria-haspopup="menu"]').click();
    setTimeout(() => resolve(${DESCRIBE_MENU}), ${String(delay)});
  })`);
}

/** Presses Esc in the open menu and describes it `delay` ms later, inside one page task. */
function escapeMenuAndSample(page: Page, delay: number): Promise<MenuSample> {
  return page.evaluate(`new Promise((resolve) => {
    document.querySelector('[role="menu"]').dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true, cancelable: true }));
    setTimeout(() => resolve(${DESCRIBE_MENU}), ${String(delay)});
  })`);
}

/** True when the chevron is turned half a turn: Tailwind's `rotate` property reads 180deg (or a matrix(-1, ~0, ~0, -1, 0, 0) transform). */
function isHalfTurn(sample: MenuSample): boolean {
  if (sample.chevronRotate === '180deg') {
    return true;
  }
  const transform = sample.chevronTransform;
  const numbers = /^matrix\((.+)\)$/.exec(transform)?.[1]?.split(',').map(Number) ?? [];
  const [a, b, c, d] = numbers;
  return (
    a !== undefined &&
    b !== undefined &&
    c !== undefined &&
    d !== undefined &&
    Math.abs(a + 1) < 0.001 &&
    Math.abs(d + 1) < 0.001 &&
    Math.abs(b) < 0.001 &&
    Math.abs(c) < 0.001
  );
}

for (const { label, width, height } of MENU_VIEWPORTS) {
  test(`@motion user menu: ${label} pops in, turns the chevron, plays its exit, then leaves the DOM`, async ({
    page,
  }) => {
    await openAdminAt(page, width, height);

    const early = await openMenuAndSample(page, 40);
    expect(early.state).toBe('open');
    expect(early.animationName).toBe('csp-pop-in');
    expect(early.expanded).toBe('true');
    // The entry animation and the chevron transition have finished.
    await page.waitForTimeout(350);
    const open = await page.evaluate<MenuSample>(DESCRIBE_MENU);
    expect(isHalfTurn(open), JSON.stringify(open)).toBe(true);

    const closing = await escapeMenuAndSample(page, 40);
    expect(closing.attached, 'still attached while the exit plays').toBe(true);
    expect(closing.state).toBe('closed');
    expect(closing.animationName).toBe('csp-pop-out');
    expect(closing.expanded).toBe('false');

    await page.waitForTimeout(300);
    await expect(page.getByRole('menu')).toHaveCount(0);
    await expect(page.locator('button[aria-haspopup="menu"]')).toBeFocused();
    const closed = await page.evaluate<MenuSample>(DESCRIBE_MENU);
    expect(isHalfTurn(closed), 'the chevron turned back').toBe(false);
  });

  test(`@motion user menu reduced: ${label} does not move under reduced motion and leaves the DOM at once`, async ({
    page,
  }) => {
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await openAdminAt(page, width, height);

    const opened = await openMenuAndSample(page, 40);
    expect(opened.animationName).toBe('none');
    expect(opened.chevronDuration).toBe('0s');

    const early = await escapeMenuAndSample(page, 40);
    expect(early.attached, JSON.stringify(early)).toBe(false);
    await expect(page.locator('button[aria-haspopup="menu"]')).toBeFocused();
  });
}

// ── D-39: the Signed-in devices dialogs ──

// A second device with a label no project shares, so its row can be told apart.
const EDGE_ON_WINDOWS =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36 Edg/126.0.0.0';

interface DialogSample {
  readonly attached: boolean;
  readonly state: string | null;
  readonly title: string;
  readonly animationName: string;
}

test('@motion sessions: the per-device dialog plays its exit with its device still named, then leaves the DOM', async ({
  page,
  browser,
  baseURL,
  request,
  guard,
}) => {
  test.setTimeout(120_000);
  // Opening the sign-in page asks the refresh cookie for a session first; with none that answer is a 401.
  guard.expectStatus('/api/v1/auth/refresh', 401);
  const staff = await createStaff(request, 'Manager');
  const other = await browser.newContext({
    baseURL: baseURL ?? 'https://localhost:5199',
    ignoreHTTPSErrors: true,
    userAgent: EDGE_ON_WINDOWS,
  });
  try {
    await signInAs(page, request, staff);
    await signInAs(await other.newPage(), request, staff);
    await page.goto('/admin/sessions');
    await expect(page.getByRole('heading', { level: 1, name: 'Signed-in devices' })).toBeVisible();

    await page.getByRole('button', { name: /^Sign out Edge on Windows, signed in / }).click();
    const dialog = page.getByRole('dialog', { name: 'Sign out Edge on Windows?' });
    await expect(dialog).toHaveAttribute('data-state', 'open');
    // The entry animation has finished, so the sample below is about the exit only.
    await page.waitForTimeout(300);

    const early = await page.evaluate<DialogSample>(`new Promise((resolve) => {
      const dialog = document.querySelector('[role="dialog"]');
      const keep = [...dialog.querySelectorAll('button')].find((button) => button.textContent.trim() === 'Keep Signed In');
      keep.click();
      setTimeout(() => {
        resolve({
          attached: dialog.isConnected,
          state: dialog.getAttribute('data-state'),
          title: dialog.querySelector('h2') === null ? '' : dialog.querySelector('h2').textContent,
          animationName: dialog.isConnected ? getComputedStyle(dialog).animationName : '',
        });
      }, 40);
    })`);

    expect(early.attached, 'still attached while the exit plays').toBe(true);
    expect(early.state).toBe('closed');
    expect(early.title, 'still names its device while it closes').toBe('Sign out Edge on Windows?');
    expect(early.animationName).toBe('csp-rise-out');

    await page.waitForTimeout(SETTLED_MS);
    await expect(page.getByRole('dialog')).toHaveCount(0);
    await expect(page.getByRole('button', { name: /^Sign out Edge on Windows, signed in / })).toBeFocused();
  } finally {
    await other.close();
  }
});

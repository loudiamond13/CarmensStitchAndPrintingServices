// Keyboard journeys (A11Y-02; UI-SPEC Interaction Contract; WCAG 2.1.1, 2.1.2, 2.4.3; plan 02-35), on the real host in
// all five projects, under the shared guard (console, page errors, CSP, failed responses):
//   - the skip link moves focus to main on `/` and on the admin shell, with no hash in the URL;
//   - Tabs: Right/Left move and select (wrapping), Home and End jump, and only the selected tab is in the Tab order;
//   - SegmentedControl: the arrows move the checked radio and the focus, wrapping at both ends;
//   - Modal (Add Payment) and slide-over (Add User): focus starts on the first field, Tab and Shift+Tab stay inside,
//     Esc closes and focus returns to the trigger;
//   - ConfirmDialog with no type-to-confirm field (Delete Payment): focus starts on Cancel, and Cancel by keyboard
//     closes it and returns focus; with the field (Delete Order) focus starts on the field;
//   - Toast: a danger toast stays until it is closed, and its Dismiss button is reachable and works by keyboard.
// Axe runs over the whole page with each dialog open. An open Modal makes the page behind it inert (R2-10, plan 04-30),
// so the demo buttons that a phone bottom sheet half covers are no longer measured.
// The drawer and user-menu journeys live in admin-keyboard.spec.ts (plan 02-32).
//
// WebKit's Tab stops on buttons and form fields only (Safari includes links only with "Press Tab to highlight each
// item"), so the webkit and iphone projects check that nothing focusable comes before the skip link and focus it
// directly; every other journey here uses buttons and fields, which WebKit's Tab reaches.
import type { Locator, Page } from '@playwright/test';
import { expect, expectNoAxeViolations, test } from './fixtures.ts';
import { openPage, PAGES } from './sweep.ts';

const SHOWCASE = PAGES.find((pageCase) => pageCase.path === '/dev/components' && pageCase.theme === 'light');

const FIRST_FOCUSABLE_TEXT = `document.querySelector('a[href], button, input, select, textarea, [tabindex]:not([tabindex="-1"])')?.textContent ?? null`;

/** Opens the showcase (about 190 cases: these journeys get more time than a plain page under a full parallel run). */
async function openShowcase(page: Page): Promise<void> {
  if (SHOWCASE === undefined) {
    throw new Error('sweep.ts no longer lists /dev/components');
  }
  test.setTimeout(120_000);
  await openPage(page, SHOWCASE);
}

/** Page-level axe with a dialog open (see the header), with the A11Y-01 tags. */
async function expectDialogAxeClean(page: Page): Promise<void> {
  await expectNoAxeViolations(page);
}

for (const path of ['/', '/admin']) {
  test(`@keyboard the skip link on ${path} is the first stop and moves focus to main`, async ({
    page,
    browserName,
  }) => {
    const response = await page.goto(path);
    expect(response?.status()).toBe(200);
    await expect(page.locator('h1')).toHaveCount(1);

    const skip = page.getByRole('link', { name: 'Skip to main content' }).first();
    expect(await page.evaluate(FIRST_FOCUSABLE_TEXT)).toBe('Skip to main content');
    if (browserName === 'webkit') {
      await skip.focus();
    } else {
      await page.keyboard.press('Tab');
    }
    await expect(skip).toBeFocused();
    await expect(skip).toBeVisible();
    await page.keyboard.press('Enter');
    await expect(page.locator('main#main')).toBeFocused();
    const url = new URL(page.url());
    expect(url.pathname).toBe(path);
    expect(url.hash).toBe('');
  });
}

test('@keyboard Tabs: Right and Left move the selection, Home and End jump, and only the selected tab takes Tab', async ({
  page,
}) => {
  await openShowcase(page);
  const frame = page.locator('[data-case="tabs-orders"]');
  const tab = (name: string): Locator => frame.getByRole('tab', { name: new RegExp(`^${name}`) });
  const expectSelected = async (name: string): Promise<void> => {
    await expect(tab(name)).toBeFocused();
    await expect(tab(name)).toHaveAttribute('aria-selected', 'true');
    await expect(frame.locator('[role="tab"][aria-selected="true"]')).toHaveCount(1);
    await expect(frame.locator('[role="tab"][tabindex="0"]')).toHaveCount(1);
    await expect(tab(name)).toHaveAttribute('tabindex', '0');
  };

  await tab('Items').focus();
  await expectSelected('Items');
  await page.keyboard.press('ArrowRight');
  await expectSelected('Payments');
  await page.keyboard.press('ArrowRight');
  await expectSelected('Discounts');
  await page.keyboard.press('End');
  await expectSelected('Expenses');
  await page.keyboard.press('ArrowRight');
  await expectSelected('Items');
  await page.keyboard.press('ArrowLeft');
  await expectSelected('Expenses');
  await page.keyboard.press('Home');
  await expectSelected('Items');
  // Up and Down are not tab keys: nothing moves.
  await page.keyboard.press('ArrowDown');
  await expectSelected('Items');
});

test('@keyboard SegmentedControl: the arrows move the checked option and the focus, wrapping at both ends', async ({
  page,
}) => {
  await openShowcase(page);
  const frame = page.locator('[data-case="segmented-text"]');
  const fixed = frame.getByRole('radio', { name: 'Fixed ₱' });
  const percent = frame.getByRole('radio', { name: 'Percent %' });
  const expectChecked = async (checked: Locator, other: Locator): Promise<void> => {
    await expect(checked).toBeFocused();
    await expect(checked).toHaveAttribute('aria-checked', 'true');
    await expect(checked).toHaveAttribute('tabindex', '0');
    await expect(other).toHaveAttribute('aria-checked', 'false');
    await expect(other).toHaveAttribute('tabindex', '-1');
  };

  await fixed.focus();
  await expectChecked(fixed, percent);
  await page.keyboard.press('ArrowRight');
  await expectChecked(percent, fixed);
  await page.keyboard.press('ArrowRight');
  await expectChecked(fixed, percent);
  await page.keyboard.press('ArrowLeft');
  await expectChecked(percent, fixed);
  await page.keyboard.press('ArrowDown');
  await expectChecked(fixed, percent);
  await page.keyboard.press('ArrowUp');
  await expectChecked(percent, fixed);
});

/** True when the toast layer's Dismiss button has focus (a page script, as FOCUS_IN_DIALOG below). */
const DISMISS_FOCUSED = `document.activeElement !== null && document.activeElement.closest('[data-ui="s-toast-layer"]') !== null && document.activeElement.getAttribute('aria-label') === 'Dismiss'`;

/**
 * Marks the last element before the toast layer that Tab stops on: links too, except in WebKit, whose Tab skips them.
 */
function markBeforeToast(withLinks: boolean): string {
  return `(() => {
    const stops = [...document.querySelectorAll('${withLinks ? 'a[href], ' : ''}button, input, select, textarea, [tabindex]')]
      .filter((element) => element.tabIndex >= 0 && !element.disabled && element.getClientRects().length > 0);
    const first = stops.findIndex((element) => element.closest('[data-ui="s-toast-layer"]') !== null);
    stops[first - 1].setAttribute('data-e2e-before-toast', '');
  })()`;
}

/** True when focus is inside the open dialog (a page script: the node program has no DOM types). */
const FOCUS_IN_DIALOG = `document.activeElement !== null && document.activeElement.closest('[role="dialog"]') !== null`;

/** Opens a dialog from its trigger by keyboard and checks the trap; returns the dialog. */
async function openByKeyboard(page: Page, trigger: Locator, dialogName: string): Promise<Locator> {
  await trigger.focus();
  await page.keyboard.press('Enter');
  const dialog = page.getByRole('dialog', { name: dialogName });
  await expect(dialog).toBeVisible();
  expect(await page.evaluate(FOCUS_IN_DIALOG), 'focus moved into the dialog').toBe(true);
  return dialog;
}

/** Twenty Tabs and five Shift+Tabs never leave the dialog. */
async function expectTrapped(page: Page): Promise<void> {
  for (let press = 0; press < 20; press += 1) {
    await page.keyboard.press('Tab');
    expect(await page.evaluate(FOCUS_IN_DIALOG), `Tab ${String(press + 1)} stays in the dialog`).toBe(true);
  }
  for (let press = 0; press < 5; press += 1) {
    await page.keyboard.press('Shift+Tab');
    expect(await page.evaluate(FOCUS_IN_DIALOG), `Shift+Tab ${String(press + 1)} stays in the dialog`).toBe(true);
  }
}

for (const { trigger, dialog: dialogName, field } of [
  { trigger: 'Open Add Payment', dialog: 'Add Payment', field: 'Amount' },
  { trigger: 'Open Add User', dialog: 'Add User', field: 'First name' },
]) {
  test(`@keyboard ${dialogName}: focus starts on the first field, Tab is trapped, Esc closes and returns focus`, async ({
    page,
  }) => {
    await openShowcase(page);
    const button = page.getByRole('button', { name: trigger });
    const dialog = await openByKeyboard(page, button, dialogName);
    await expect(dialog.getByRole('textbox', { name: field })).toBeFocused();
    await expectTrapped(page);
    await expectDialogAxeClean(page);

    await page.keyboard.press('Escape');
    await expect(dialog).toHaveCount(0);
    await expect(button).toBeFocused();
  });
}

test('@keyboard ConfirmDialog with no field: focus starts on Cancel, Tab is trapped, Cancel closes and returns focus', async ({
  page,
}) => {
  await openShowcase(page);
  const button = page.getByRole('button', { name: 'Open Delete Payment' });
  const dialog = await openByKeyboard(page, button, 'Delete payment of ₱2,000.00?');
  const cancel = dialog.getByRole('button', { name: 'Cancel' });
  await expect(cancel).toBeFocused();
  await expectTrapped(page);
  await expectDialogAxeClean(page);

  await cancel.focus();
  await page.keyboard.press('Enter');
  await expect(dialog).toHaveCount(0);
  await expect(button).toBeFocused();
});

test('@keyboard ConfirmDialog with the type-to-confirm field: focus starts on the field, and Esc returns focus', async ({
  page,
}) => {
  await openShowcase(page);
  const button = page.locator('[data-case="confirm-delete-order"]').getByRole('button', { name: 'Open Delete Order' });
  const dialog = await openByKeyboard(page, button, 'Delete order ORD-2026-0148?');
  await expect(dialog.getByRole('textbox')).toBeFocused();
  await expect(dialog.getByRole('button', { name: 'Delete Order' })).toBeDisabled();
  await expectTrapped(page);

  await page.keyboard.press('Escape');
  await expect(dialog).toHaveCount(0);
  await expect(button).toBeFocused();
});

test('@keyboard a danger toast stays until its Dismiss button is pressed by keyboard', async ({
  page,
  browserName,
}) => {
  await openShowcase(page);
  const trigger = page.getByRole('button', { name: 'Show danger toast' });
  await trigger.focus();
  await page.keyboard.press('Enter');

  const layer = page.locator('[data-ui="s-toast-layer"]');
  // The layer is the live region; a toast in it has no role of its own (UI-WR-04).
  const toast = layer.locator(':scope > *', { hasText: "Couldn't save order" });
  await expect(toast).toContainText("Couldn't save order");
  // Danger toasts persist (D-04): still there after the 4.5 s a success toast would last.
  await page.waitForTimeout(5000);
  await expect(toast).toBeVisible();

  // The toast layer sits at the end of the admin page root, after everything else that takes focus, so one Tab from
  // the page's last focusable element reaches its Dismiss button (no dialog is open, so no focus trap stands in the
  // way, plan 02-22). Going round from the top with Shift+Tab would pass through the browser's own controls, whose
  // number differs by engine.
  await page.evaluate(markBeforeToast(browserName !== 'webkit'));
  await page.locator('[data-e2e-before-toast]').focus();
  await page.keyboard.press('Tab');
  expect(await page.evaluate<boolean>(DISMISS_FOCUSED), 'Tab reaches the toast Dismiss button').toBe(true);
  await expect(layer.getByRole('button', { name: 'Dismiss' })).toBeFocused();
  await page.keyboard.press('Enter');
  await expect(toast).toHaveCount(0);
});

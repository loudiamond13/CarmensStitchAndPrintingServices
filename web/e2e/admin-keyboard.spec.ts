// Admin keyboard journeys (A11Y-02, WEB-05, WCAG 2.1.1 / 2.1.2 / 2.4.3; plan 02-32): the phone navigation drawer and
// the user menu work by keyboard alone on the real host, in all five projects. Every journey runs under the shared
// guard (console, page errors, CSP, failed responses) and checks axe with the overlay open. The desktop projects run
// the drawer journey on a 390px-wide page, where the Topbar shows its "Open navigation" button.
//
// WebKit's Tab stops on buttons and form fields only (Safari includes links only with "Press Tab to highlight each
// item"), so in the webkit and iphone projects the Tab cycle in the drawer visits its buttons; the trap is the same.
import type { Page } from '@playwright/test';
import { expect, expectNoAxeViolations, test } from './fixtures.ts';

/** The phone page width of the drawer journeys (the approved phone frame). */
const PHONE = { width: 390, height: 844 } as const;

/** What has focus now (a page script: the node program has no DOM types). */
interface FocusState {
  readonly inDrawer: boolean;
  readonly label: string | null;
  readonly text: string;
}

const READ_FOCUS = `(() => {
  const element = document.activeElement;
  return {
    inDrawer: element !== null && element.closest('[role="dialog"][aria-label="Navigation"]') !== null,
    label: element?.getAttribute('aria-label') ?? null,
    text: (element?.textContent ?? '').trim(),
  };
})()`;

async function focusState(page: Page): Promise<FocusState> {
  return page.evaluate<FocusState>(READ_FOCUS);
}

/** Opens /admin on a phone-wide page and waits for the shell. */
async function openAdminOnPhone(page: Page): Promise<void> {
  await page.setViewportSize(PHONE);
  const response = await page.goto('/admin');
  expect(response?.status()).toBe(200);
  await expect(page.locator('h1')).toHaveText('Dashboard');
}

test('@keyboard @admin the navigation drawer opens from the menu button, traps Tab and closes on Esc back to the button', async ({
  page,
}) => {
  await openAdminOnPhone(page);
  const menu = page.getByRole('button', { name: 'Open navigation' });
  await expect(menu).toBeVisible();
  await expect(menu).toHaveAttribute('aria-expanded', 'false');

  await menu.focus();
  await page.keyboard.press('Enter');

  const drawer = page.getByRole('dialog', { name: 'Navigation' });
  await expect(drawer).toBeVisible();
  await expect(drawer).toHaveAttribute('aria-modal', 'true');
  await expect(menu).toHaveAttribute('aria-expanded', 'true');
  expect(await menu.getAttribute('aria-controls')).toBe(await drawer.getAttribute('id'));
  expect((await focusState(page)).inDrawer).toBe(true);

  // The 248px panel at the left edge, over the scrim, inside the viewport; body scroll is locked by the class.
  const box = await drawer.boundingBox();
  expect(box?.x).toBe(0);
  expect(box?.y).toBe(0);
  expect(box?.width).toBe(248);
  expect(await page.evaluate(`document.body.classList.contains('overflow-hidden')`)).toBe(true);

  // Tab cycles inside: twenty presses never leave the drawer and come back round to where they started.
  const start = await focusState(page);
  const seen: FocusState[] = [];
  for (let press = 0; press < 20; press += 1) {
    await page.keyboard.press('Tab');
    const now = await focusState(page);
    expect(now.inDrawer, `Tab ${String(press + 1)} stays in the drawer`).toBe(true);
    seen.push(now);
  }
  expect(seen).toContainEqual(start);
  for (let press = 0; press < 5; press += 1) {
    await page.keyboard.press('Shift+Tab');
    expect((await focusState(page)).inDrawer).toBe(true);
  }

  await expectNoAxeViolations(page);

  await page.keyboard.press('Escape');
  await expect(drawer).toHaveCount(0);
  await expect(menu).toBeFocused();
  await expect(menu).toHaveAttribute('aria-expanded', 'false');
  expect(await page.evaluate(`document.body.classList.contains('overflow-hidden')`)).toBe(false);
  await expectNoAxeViolations(page);
});

test('@keyboard @admin following a link in the drawer goes there, closes the drawer and returns focus to the button', async ({
  page,
}) => {
  await openAdminOnPhone(page);
  const menu = page.getByRole('button', { name: 'Open navigation' });
  await menu.focus();
  await page.keyboard.press('Enter');
  const drawer = page.getByRole('dialog', { name: 'Navigation' });

  const orders = drawer.getByRole('link', { name: 'Orders' });
  await orders.focus();
  await page.keyboard.press('Enter');

  await expect(page.locator('h1')).toHaveText('Orders');
  await expect(page).toHaveURL(/\/admin\/orders$/);
  await expect(drawer).toHaveCount(0);
  await expect(menu).toBeFocused();
});

test('@keyboard @admin a tap on the scrim closes the drawer', async ({ page }) => {
  await openAdminOnPhone(page);
  const menu = page.getByRole('button', { name: 'Open navigation' });
  await menu.click();
  const drawer = page.getByRole('dialog', { name: 'Navigation' });
  await expect(drawer).toBeVisible();

  // The scrim is the uncovered strip right of the 248px panel.
  await page.mouse.click(PHONE.width - 20, PHONE.height / 2);

  await expect(drawer).toHaveCount(0);
  await expect(page.locator('h1')).toHaveText('Dashboard');
  await expect(menu).toBeFocused();
});

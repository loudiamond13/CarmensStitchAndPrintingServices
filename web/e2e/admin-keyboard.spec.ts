// Admin keyboard journeys (A11Y-02, WEB-05, WCAG 2.1.1 / 2.1.2 / 2.4.3; plan 02-32): the phone navigation drawer and
// the user menu work by keyboard alone on the real host, in all five projects. Every journey runs under the shared
// guard (console, page errors, CSP, failed responses) and checks axe with the overlay open. The desktop projects run
// the drawer journey on a 390px-wide page, where the Topbar shows its "Open navigation" button (named "Close navigation"
// while the drawer is open, D-34).
//
// WebKit's Tab stops on buttons and form fields only (Safari includes links only with "Press Tab to highlight each
// item"), so in the webkit and iphone projects the Tab cycle in the drawer visits its buttons; the trap is the same.
import type { Page } from '@playwright/test';
import { signInAs } from './auth.ts';
import { expect, expectNoAxeViolations, test } from './fixtures.ts';
import { createStaff } from './testing-api.ts';

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
  const menu = page.getByRole('button', { name: /^(Open|Close) navigation$/ });
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

  // The 248px panel at the left edge, over the scrim, inside the viewport; body scroll is locked by the class. Measured
  // once the slide-in (D-34) has finished.
  await page.evaluate(
    `Promise.all(document.querySelector('[role="dialog"][aria-label="Navigation"]').getAnimations().map((animation) => animation.finished))`,
  );
  const box = await drawer.boundingBox();
  expect(box?.x).toBe(0);
  expect(box?.y).toBe(0);
  expect(box?.width).toBe(248);
  expect(box?.height).toBe(PHONE.height);
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
  const menu = page.getByRole('button', { name: /^(Open|Close) navigation$/ });
  await menu.focus();
  await page.keyboard.press('Enter');
  const drawer = page.getByRole('dialog', { name: 'Navigation' });

  // A marker on the window survives an in-app navigation and is gone after a full page load.
  await page.evaluate(`window.cspsSameDocument = true`);
  const orders = drawer.getByRole('link', { name: 'Orders' });
  await orders.focus();
  await page.keyboard.press('Enter');

  await expect(page.locator('h1')).toHaveText('Orders');
  await expect(page).toHaveURL(/\/admin\/orders$/);
  expect(await page.evaluate(`window.cspsSameDocument === true`), 'the router handled the link').toBe(true);
  await expect(drawer).toHaveCount(0);
  await expect(menu).toBeFocused();
});

test('@keyboard @admin a tap on the scrim closes the drawer', async ({ page }) => {
  await openAdminOnPhone(page);
  const menu = page.getByRole('button', { name: /^(Open|Close) navigation$/ });
  await menu.click();
  const drawer = page.getByRole('dialog', { name: 'Navigation' });
  await expect(drawer).toBeVisible();

  // The scrim is the uncovered strip right of the 248px panel.
  await page.mouse.click(PHONE.width - 20, PHONE.height / 2);

  await expect(drawer).toHaveCount(0);
  await expect(page.locator('h1')).toHaveText('Dashboard');
  await expect(menu).toBeFocused();
});

test('@keyboard @admin the user menu opens from its button, moves with the arrow keys and closes on Esc back to the button', async ({
  page,
  guard,
}) => {
  // Logout lands on the sign-in page, which asks the refresh cookie for a session first; with none that answer is a 401.
  guard.expectStatus('/api/v1/auth/refresh', 401);
  const response = await page.goto('/admin');
  expect(response?.status()).toBe(200);
  await expect(page.locator('h1')).toHaveText('Dashboard');
  const button = page.locator('button[aria-haspopup="menu"]');
  await expect(button).toBeVisible();
  await expect(button).toHaveAttribute('aria-expanded', 'false');

  await button.focus();
  await page.keyboard.press('Enter');

  const menu = page.getByRole('menu');
  await expect(menu).toBeVisible();
  await expect(button).toHaveAttribute('aria-expanded', 'true');
  expect(await button.getAttribute('aria-controls')).toBe(await menu.getAttribute('id'));
  const profile = menu.getByRole('menuitem', { name: 'My Profile' });
  const devices = menu.getByRole('menuitem', { name: 'Signed-in Devices' });
  const signOutOthers = menu.getByRole('menuitem', { name: 'Sign Out Other Devices' });
  const logout = menu.getByRole('menuitem', { name: 'Logout' });
  await expect(profile).toBeFocused();

  // The popover sits under the button, inside the viewport.
  const buttonBox = await button.boundingBox();
  const menuBox = await menu.boundingBox();
  expect(menuBox?.y ?? 0).toBeGreaterThanOrEqual((buttonBox?.y ?? 0) + (buttonBox?.height ?? 0));
  expect(menuBox?.width ?? 0).toBeGreaterThanOrEqual(200);
  const viewport = page.viewportSize();
  expect((menuBox?.x ?? 0) + (menuBox?.width ?? 0)).toBeLessThanOrEqual(viewport?.width ?? 0);

  await page.keyboard.press('ArrowDown');
  await expect(devices).toBeFocused();
  await page.keyboard.press('ArrowDown');
  await expect(signOutOthers).toBeFocused();
  await page.keyboard.press('ArrowDown');
  await expect(logout).toBeFocused();
  await page.keyboard.press('ArrowDown');
  await expect(profile).toBeFocused();
  await page.keyboard.press('ArrowUp');
  await expect(logout).toBeFocused();
  await page.keyboard.press('Home');
  await expect(profile).toBeFocused();
  await page.keyboard.press('End');
  await expect(logout).toBeFocused();

  await expectNoAxeViolations(page);

  await page.keyboard.press('Escape');
  await expect(menu).toHaveCount(0);
  await expect(button).toBeFocused();
  await expect(button).toHaveAttribute('aria-expanded', 'false');

  // Logout from the keyboard: it signs out and leaves the shell for the sign-in page (Phase 4).
  await page.keyboard.press('ArrowUp');
  await expect(logout).toBeFocused();
  await page.keyboard.press('Enter');
  await expect(page).toHaveURL(/\/admin\/login$/);
});

test('@keyboard @admin "Sign Out Other Devices" opens a dialog over an inert page, and Esc returns focus to the menu button', async ({
  page,
}) => {
  await openAdminOnPhone(page);
  const button = page.locator('button[aria-haspopup="menu"]');

  await button.focus();
  await page.keyboard.press('ArrowDown');
  await page.keyboard.press('ArrowDown');
  await page.keyboard.press('ArrowDown');
  const item = page.getByRole('menuitem', { name: 'Sign Out Other Devices' });
  await expect(item).toBeFocused();
  await page.keyboard.press('Enter');

  const dialog = page.getByRole('dialog', { name: 'Sign out of other devices?' });
  await expect(dialog).toBeVisible();
  await expect(dialog.getByRole('button', { name: 'Keep Others Signed In' })).toBeFocused();
  // R2-10: the shell behind the dialog is inert, so page-level axe on a phone no longer measures it.
  expect(await page.evaluate(`document.querySelector('main#main')?.closest('[inert]') !== null`)).toBe(true);
  await expectNoAxeViolations(page);

  await page.keyboard.press('Escape');
  await expect(dialog).toHaveCount(0);
  await expect(button).toBeFocused();
  expect(await page.evaluate(`document.querySelector('[inert]') === null`)).toBe(true);
});

test('@keyboard @admin "My Profile" in the user menu goes to the profile page in the app', async ({
  page,
  request,
  guard,
}) => {
  // My Profile is a real, guarded page (plan 05-13): the person signs in first. Opening the sign-in page asks the refresh
  // cookie for a session, and with none that answer is a 401.
  guard.expectStatus('/api/v1/auth/refresh', 401);
  await signInAs(page, request, await createStaff(request, 'Manager'));
  await expect(page.locator('h1')).toHaveText('Dashboard');
  await page.evaluate(`window.cspsSameDocument = true`);
  const button = page.locator('button[aria-haspopup="menu"]');

  await button.focus();
  await page.keyboard.press('ArrowDown');
  await expect(page.getByRole('menuitem', { name: 'My Profile' })).toBeFocused();
  await page.keyboard.press('Enter');

  await expect(page.getByRole('tab', { name: 'Details' })).toBeVisible();
  await expect(page).toHaveTitle('My Profile · CSPS Admin');
  await expect(page).toHaveURL(/\/admin\/profile$/);
  expect(await page.evaluate(`window.cspsSameDocument === true`), 'the router handled the link').toBe(true);
  await expect(page.getByRole('menu')).toHaveCount(0);
});

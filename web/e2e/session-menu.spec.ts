// The session items of the admin user menu end to end (D-04, D-05, D-43, D-44, OQ-3, R2-10; plan 04-30), in all five
// projects. One staff member is signed in on two browser contexts. The first opens the user menu, sees the four items,
// signs the other device out through the confirm dialog (page-level axe runs with the dialog open, so the page behind it
// is inert), and stays signed in itself. Each test makes its own staff user.
import { signInAs } from './auth.ts';
import { expect, expectNoAxeViolations, test } from './fixtures.ts';
import { createStaff } from './testing-api.ts';

test('@session-menu Sign Out Other Devices from the user menu ends the other browser and keeps this one', async ({
  page,
  browser,
  baseURL,
  request,
  guard,
}) => {
  // Two sign-ins and several dialogs in one test: WebKit under four parallel workers needs more than 30 seconds.
  test.setTimeout(120_000);
  // Opening the sign-in page asks the refresh cookie for a session first; with none that answer is a 401.
  guard.expectStatus('/api/v1/auth/refresh', 401);
  const staff = await createStaff(request, 'Manager');

  const other = await browser.newContext({
    baseURL: baseURL ?? 'https://localhost:5199',
    ignoreHTTPSErrors: true,
  });
  try {
    await signInAs(page, request, staff);
    const otherPage = await other.newPage();
    await signInAs(otherPage, request, staff);

    // OQ-3: the menu lists the four items in order; Esc closes it with focus back on its button.
    const menuButton = page.locator('button[aria-haspopup="menu"]');
    await menuButton.click();
    const menu = page.getByRole('menu');
    await expect(menu.getByRole('menuitem')).toHaveText([
      'My Profile',
      'Signed-in Devices',
      'Sign Out Other Devices',
      'Logout',
    ]);
    await page.keyboard.press('Escape');
    await expect(menu).toBeHidden();
    await expect(menuButton).toBeFocused();

    // D-05, D-44: the confirm names the other devices and puts the safe choice in focus; the page behind is inert.
    await menuButton.click();
    await menu.getByRole('menuitem', { name: 'Sign Out Other Devices' }).click();
    const dialog = page.getByRole('dialog', { name: 'Sign out of other devices?' });
    await expect(dialog).toBeVisible();
    await expect(dialog.getByRole('button', { name: 'Keep Others Signed In' })).toBeFocused();
    await expectNoAxeViolations(page);

    await dialog.getByRole('button', { name: 'Sign Out Other Devices' }).click();
    await expect(dialog).toBeHidden();
    await expect(page.getByText('Signed out of other devices')).toBeVisible();
    await expect(page.getByText("You're still signed in on this device.")).toBeVisible();
    await expect(menuButton).toBeFocused();

    // The other browser's refresh cookie no longer works.
    await otherPage.goto('/admin/sessions');
    await expect(otherPage.getByRole('heading', { level: 1, name: 'Sign in' })).toBeVisible();

    // D-43: the devices item opens the S7 page, and this session survives a reload there.
    await menuButton.click();
    await menu.getByRole('menuitem', { name: 'Signed-in Devices' }).click();
    await expect(page).toHaveURL(/\/admin\/sessions$/);
    await expect(page.getByRole('heading', { level: 1, name: 'Signed-in devices' })).toBeVisible();
    await page.reload();
    await expect(page.getByRole('heading', { level: 1, name: 'Signed-in devices' })).toBeVisible();

    // D-44: nothing else is signed in now, and the same dialog flow ends with the same toast.
    await menuButton.click();
    await menu.getByRole('menuitem', { name: 'Sign Out Other Devices' }).click();
    const again = page.getByRole('dialog', { name: 'Sign out of other devices?' });
    await again.getByRole('button', { name: 'Sign Out Other Devices' }).click();
    await expect(again).toBeHidden();
    await expect(page.getByText('Signed out of other devices').first()).toBeVisible();
    await expect(menuButton).toBeFocused();
    await expectNoAxeViolations(page);
  } finally {
    await other.close();
  }
});

test('@session-menu a second Sign Out Other Devices in one visit ends a device that signed in after the first', async ({
  page,
  browser,
  baseURL,
  request,
  guard,
}) => {
  test.setTimeout(120_000);
  guard.expectStatus('/api/v1/auth/refresh', 401);
  const staff = await createStaff(request, 'Manager');
  const contextOptions = { baseURL: baseURL ?? 'https://localhost:5199', ignoreHTTPSErrors: true };
  const second = await browser.newContext(contextOptions);
  const third = await browser.newContext(contextOptions);
  try {
    await signInAs(page, request, staff);
    const secondPage = await second.newPage();
    await signInAs(secondPage, request, staff);

    const menuButton = page.locator('button[aria-haspopup="menu"]');
    const menu = page.getByRole('menu');
    const dialog = page.getByRole('dialog', { name: 'Sign out of other devices?' });

    await menuButton.click();
    await menu.getByRole('menuitem', { name: 'Sign Out Other Devices' }).click();
    await dialog.getByRole('button', { name: 'Sign Out Other Devices' }).click();
    await expect(dialog).toBeHidden();
    await expect(menuButton).toBeFocused();
    await secondPage.goto('/admin/sessions');
    await expect(secondPage.getByRole('heading', { level: 1, name: 'Sign in' })).toBeVisible();

    // A device signs in after the first use; this page is not reloaded before the second.
    const thirdPage = await third.newPage();
    await signInAs(thirdPage, request, staff);

    await menuButton.click();
    await menu.getByRole('menuitem', { name: 'Sign Out Other Devices' }).click();
    await dialog.getByRole('button', { name: 'Sign Out Other Devices' }).click();
    await expect(dialog).toBeHidden();
    await expect(page.getByText('Signed out of other devices').first()).toBeVisible();
    await expect(menuButton).toBeFocused();

    await thirdPage.goto('/admin/sessions');
    await expect(thirdPage.getByRole('heading', { level: 1, name: 'Sign in' })).toBeVisible();
  } finally {
    await second.close();
    await third.close();
  }
});

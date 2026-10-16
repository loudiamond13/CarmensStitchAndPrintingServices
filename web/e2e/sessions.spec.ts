// Signed-in devices end to end (AUTH-06, D-43, D-44; plan 04-29), in all five projects. One staff member is signed in on
// two browser contexts. The first opens /admin/sessions and sees both devices, signs the other out through the confirm
// dialog, and the other browser can no longer get a session. Each test makes its own staff user.
import { signInAs } from './auth.ts';
import { expect, expectNoAxeViolations, test } from './fixtures.ts';
import { createStaff } from './testing-api.ts';

// A second device with a label no project shares ("Edge on Windows"), so the two rows can be told apart.
const EDGE_ON_WINDOWS =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36 Edg/126.0.0.0';

test('@sessions the devices page lists both browsers and signing one out ends its session', async ({
  page,
  browser,
  baseURL,
  request,
  guard,
}) => {
  // Two sign-ins, the page and a sign-out in one test: WebKit under four parallel workers needs more than 30 seconds.
  test.setTimeout(90_000);
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
    const otherPage = await other.newPage();
    await signInAs(otherPage, request, staff);

    // D-43: the page lists both devices, this one first.
    await page.goto('/admin/sessions');
    await expect(page.getByRole('heading', { level: 1, name: 'Signed-in devices' })).toBeVisible();
    await expect(page).toHaveTitle('Signed-in Devices · CSPS Admin');
    const rows = page.locator('tbody tr');
    await expect(rows).toHaveCount(2);
    await expect(rows.first()).toContainText('This device');
    await expect(rows.first().getByRole('button')).toHaveCount(0);
    await expect(rows.nth(1)).toContainText('Edge on Windows');
    // D-44: the header button is always there.
    await expect(page.getByRole('button', { name: 'Sign Out Other Devices' })).toBeEnabled();
    expect(await page.evaluate('document.documentElement.scrollWidth <= window.innerWidth')).toBe(true);
    await expectNoAxeViolations(page);

    // Espresso, the other admin theme, has the same page.
    await page.getByRole('button', { name: 'Switch to dark mode' }).click();
    await expect(page.locator('[data-theme]').first()).toHaveAttribute('data-theme', 'dark');
    await expectNoAxeViolations(page);
    await page.getByRole('button', { name: 'Switch to light mode' }).click();

    // The row's sign-out button names the device and when it signed in; the safe choice has the focus.
    await page.getByRole('button', { name: /^Sign out Edge on Windows, signed in / }).click();
    const dialog = page.getByRole('dialog', { name: 'Sign out Edge on Windows?' });
    await expect(dialog).toBeVisible();
    await expect(dialog.getByRole('button', { name: 'Keep Signed In' })).toBeFocused();
    await expectNoAxeViolations(page);

    await dialog.getByRole('button', { name: 'Sign Out Device' }).click();
    await expect(dialog).toBeHidden();
    await expect(page.getByText('Device signed out')).toBeVisible();
    await expect(page.getByText('Edge on Windows will have to sign in again.')).toBeVisible();
    await expect(rows).toHaveCount(1);
    await expect(
      page.getByText('No other devices are signed in. When you sign in somewhere else, it shows up here.'),
    ).toBeVisible();
    // Only this device is left, so focus lands on the page heading.
    await expect(page.getByRole('heading', { level: 1, name: 'Signed-in devices' })).toBeFocused();
    await expectNoAxeViolations(page);

    // This session is untouched: the page still works after a reload.
    await page.reload();
    await expect(page.getByRole('heading', { level: 1, name: 'Signed-in devices' })).toBeVisible();
    await expect(rows).toHaveCount(1);

    // The other browser's refresh cookie no longer works: opening the page there ends at the sign-in screen.
    await otherPage.goto('/admin/sessions');
    await expect(otherPage.getByRole('heading', { level: 1, name: 'Sign in' })).toBeVisible();
    await expect(otherPage).toHaveURL(/\/admin\/login/);
  } finally {
    await other.close();
  }
});

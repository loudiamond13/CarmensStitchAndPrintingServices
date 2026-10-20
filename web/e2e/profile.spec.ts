// My Profile end to end (PROF-01, PROF-04, SEC-07, D-20, D-22, D-23; plan 05-13), in all five projects. One staff member is
// signed in; each test makes its own staff user. The page is the real, guarded /admin/profile (the e2e bundle's dev
// previews no longer shadow it). Every test runs under the shared guard (console, page errors, CSP, failed responses).
import type { Page } from '@playwright/test';
import { signInAs, type SignedInUser } from './auth.ts';
import { expect, expectNoAxeViolations, test } from './fixtures.ts';
import { createStaff } from './testing-api.ts';

const TABS = ['Details', 'Security', 'Appearance'] as const;

/** True when the page does not scroll sideways (a page script: the node program has no DOM). */
const NO_SIDEWAYS_SCROLL = 'document.documentElement.scrollWidth <= window.innerWidth';

function firstName(page: Page) {
  return page.getByRole('textbox', { name: 'First name' });
}

function fullName(user: SignedInUser): string {
  return `${user.firstName} ${user.lastName}`;
}

function pageRoot(page: Page) {
  return page.locator('[data-theme]').first();
}

test('@profile the tabs follow the URL and the keyboard, and every tab passes axe without sideways scrolling', async ({
  page,
  request,
  guard,
}) => {
  test.setTimeout(90_000);
  // Opening the sign-in page asks the refresh cookie for a session first; with none that answer is a 401.
  guard.expectStatus('/api/v1/auth/refresh', 401);
  const user = await signInAs(page, request, await createStaff(request, 'Manager'));

  // The header: the name, the role and "{email} · Member since {date}".
  await page.goto('/admin/profile');
  await expect(page.getByRole('heading', { level: 1, name: fullName(user) })).toBeVisible();
  await expect(page).toHaveTitle('My Profile · CSPS Admin');
  await expect(page.getByText(`${user.email} · Member since `)).toBeVisible();
  await expect(page.getByRole('tab', { name: 'Details' })).toHaveAttribute('aria-selected', 'true');
  await expect(page.getByRole('heading', { level: 2, name: 'Personal Information' })).toBeVisible();
  await expectNoAxeViolations(page);
  expect(await page.evaluate(NO_SIDEWAYS_SCROLL)).toBe(true);

  // WEB-10: an invalid tab shows Details and leaves the URL.
  await page.goto('/admin/profile?tab=bogus');
  await expect(page.getByRole('heading', { level: 2, name: 'Personal Information' })).toBeVisible();
  await expect(page).toHaveURL(/\/admin\/profile$/);

  // D-23: the arrow keys, Home and End move between the tabs and write the tab to the URL; Details stays out of it.
  await page.getByRole('tab', { name: 'Details' }).focus();
  await page.keyboard.press('ArrowRight');
  await expect(page.getByRole('tab', { name: 'Security' })).toBeFocused();
  await expect(page).toHaveURL(/\/admin\/profile\?tab=security$/);
  await expect(page.getByRole('heading', { level: 2, name: 'Signed-in Devices' })).toBeVisible();
  await expect(page.getByRole('link', { name: 'View Signed-in Devices' })).toHaveAttribute('href', '/admin/sessions');
  await expectNoAxeViolations(page);
  expect(await page.evaluate(NO_SIDEWAYS_SCROLL)).toBe(true);

  await page.keyboard.press('End');
  await expect(page.getByRole('tab', { name: 'Appearance' })).toBeFocused();
  await expect(page).toHaveURL(/\/admin\/profile\?tab=appearance$/);
  await expect(page.getByRole('heading', { level: 2, name: 'Theme' })).toBeVisible();
  await expectNoAxeViolations(page);
  expect(await page.evaluate(NO_SIDEWAYS_SCROLL)).toBe(true);

  await page.keyboard.press('Home');
  await expect(page.getByRole('tab', { name: 'Details' })).toBeFocused();
  await expect(page).toHaveURL(/\/admin\/profile$/);

  // A reload on a tab keeps the tab.
  await page.goto('/admin/profile?tab=security');
  await expect(page.getByRole('tab', { name: 'Security' })).toHaveAttribute('aria-selected', 'true');
  for (const tab of TABS) {
    await expect(page.getByRole('tab', { name: tab })).toBeVisible();
  }
});

test('@profile Espresso from the Appearance tab sticks on this browser, and the public site stays light', async ({
  page,
  request,
  guard,
}) => {
  test.setTimeout(90_000);
  guard.expectStatus('/api/v1/auth/refresh', 401);
  await signInAs(page, request, await createStaff(request, 'Manager'));

  await page.goto('/admin/profile?tab=appearance');
  await expect(pageRoot(page)).toHaveAttribute('data-theme', 'light');
  await expect(page.getByRole('radio', { name: 'Blush (light)' })).toHaveAttribute('aria-checked', 'true');

  // D-22: the choice applies at once, is announced, and agrees with the top bar toggle.
  await page.getByRole('radio', { name: 'Espresso (dark)' }).click();
  await expect(pageRoot(page)).toHaveAttribute('data-theme', 'dark');
  await expect(page.getByText('Theme changed to Espresso (dark).')).toBeAttached();
  await expect(page.getByRole('button', { name: 'Switch to light mode' })).toBeVisible();
  expect(await page.evaluate(`localStorage.getItem('csps-theme')`)).toBe('dark');
  await expectNoAxeViolations(page);
  for (const tab of ['Security', 'Details'] as const) {
    await page.getByRole('tab', { name: tab }).click();
    await expect(page.getByRole('tab', { name: tab })).toHaveAttribute('aria-selected', 'true');
    await expectNoAxeViolations(page);
  }

  // The top bar toggle changes the same state, and the control follows it.
  await page.getByRole('tab', { name: 'Appearance' }).click();
  await page.getByRole('button', { name: 'Switch to light mode' }).click();
  await expect(pageRoot(page)).toHaveAttribute('data-theme', 'light');
  await expect(page.getByRole('radio', { name: 'Blush (light)' })).toHaveAttribute('aria-checked', 'true');
  await page.getByRole('radio', { name: 'Espresso (dark)' }).click();

  // The choice survives a reload.
  await page.reload();
  await expect(page.getByRole('heading', { level: 2, name: 'Theme' })).toBeVisible();
  await expect(pageRoot(page)).toHaveAttribute('data-theme', 'dark');
  await expect(page.getByRole('radio', { name: 'Espresso (dark)' })).toHaveAttribute('aria-checked', 'true');

  // Another tab of this browser has it after it loads (per-browser storage).
  const other = await page.context().newPage();
  await other.goto('/admin/profile?tab=appearance');
  await expect(other.getByRole('heading', { level: 2, name: 'Theme' })).toBeVisible();
  await expect(pageRoot(other)).toHaveAttribute('data-theme', 'dark');
  await other.close();

  // The public site never reads it.
  await page.goto('/');
  await expect(pageRoot(page)).toHaveAttribute('data-theme', 'light');
});

test('@profile renaming saves, and the sidebar, the top bar and the header show the new name', async ({
  page,
  request,
  guard,
}) => {
  test.setTimeout(90_000);
  guard.expectStatus('/api/v1/auth/refresh', 401);
  const user = await signInAs(page, request, await createStaff(request, 'Manager'));
  await page.goto('/admin/profile');
  await expect(page.getByRole('heading', { level: 1, name: fullName(user) })).toBeVisible();

  // OR-3: a blank name is refused in the browser, before any request.
  await firstName(page).fill('');
  await page.getByRole('button', { name: 'Save Changes' }).click();
  await expect(page.getByText('Enter a first name.')).toBeVisible();
  await expect(firstName(page)).toBeFocused();
  await expectNoAxeViolations(page);

  await firstName(page).fill('Renamed');
  await page.getByRole('button', { name: 'Save Changes' }).click();

  await expect(page.getByText('Changes saved')).toBeVisible();
  await expect(page.getByText('Your name is updated.')).toBeVisible();
  const renamed = `Renamed ${user.lastName}`;
  await expect(page.getByRole('heading', { level: 1, name: renamed })).toBeVisible();
  // The session is refreshed, so the shell shows the name without a reload: the sidebar chip and the top bar.
  await expect(page.locator('aside').first()).toContainText(renamed);
  await expect(page.getByRole('button', { name: new RegExp(renamed) }).first()).toBeAttached();

  // The new name is the stored one.
  await page.reload();
  await expect(page.getByRole('heading', { level: 1, name: renamed })).toBeVisible();
  await expect(firstName(page)).toHaveValue('Renamed');
});

test('@profile a stale save keeps what was typed behind the conflict banner, and Load Latest shows the other save', async ({
  page,
  request,
  guard,
}) => {
  test.setTimeout(120_000);
  guard.expectStatus('/api/v1/auth/refresh', 401);
  // The stale save is refused with a 409 on purpose (D-20).
  guard.expectStatus('/api/v1/profile', 409);
  const user = await signInAs(page, request, await createStaff(request, 'Manager'));
  await page.goto('/admin/profile');
  await expect(page.getByRole('heading', { level: 1, name: fullName(user) })).toBeVisible();

  // A second page of the same person opens the same profile version.
  const second = await page.context().newPage();
  await second.goto('/admin/profile');
  await expect(second.getByRole('heading', { level: 1, name: fullName(user) })).toBeVisible();

  // The first page saves first.
  await firstName(page).fill('Firstsave');
  await page.getByRole('button', { name: 'Save Changes' }).click();
  await expect(page.getByText('Changes saved')).toBeVisible();

  // The second page's save is stale: the banner shows, the typed value stays, and Load Latest has the focus.
  await firstName(second).fill('Secondtry');
  await second.getByRole('button', { name: 'Save Changes' }).click();
  const banner = second.getByRole('alert');
  await expect(banner.getByText('This was changed by someone else.')).toBeVisible();
  await expect(
    banner.getByText('Reload and try again. Your typed changes stay here until you press Load Latest.'),
  ).toBeVisible();
  await expect(banner.getByRole('button', { name: 'Load Latest' })).toBeFocused();
  await expect(firstName(second)).toHaveValue('Secondtry');
  await expect(second.getByText('Changes saved')).toHaveCount(0);
  // From the top of the page: on a phone the sticky tab bar would otherwise cover the field the banner pushed down.
  await second.evaluate('window.scrollTo(0, 0)');
  await expectNoAxeViolations(second);
  expect(await second.evaluate(NO_SIDEWAYS_SCROLL)).toBe(true);

  // Load Latest brings the first page's save, drops the banner and puts the cursor in First name.
  await banner.getByRole('button', { name: 'Load Latest' }).click();
  await expect(second.getByRole('alert')).toHaveCount(0);
  await expect(firstName(second)).toHaveValue('Firstsave');
  await expect(firstName(second)).toBeFocused();
  await expect(second.getByText('Latest version loaded. Make your changes again.')).toBeAttached();

  // Making the change again now succeeds, against the latest version.
  await firstName(second).fill('Secondtry');
  await second.getByRole('button', { name: 'Save Changes' }).click();
  await expect(second.getByText('Changes saved')).toBeVisible();
  await expect(second.getByRole('heading', { level: 1, name: `Secondtry ${user.lastName}` })).toBeVisible();
  await second.close();
});

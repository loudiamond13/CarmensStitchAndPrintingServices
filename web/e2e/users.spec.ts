// The Users roster end to end (USER-01, USER-08, WEB-10, D-19; plan 05-20), in all five projects. A Manager signs in and
// the roster lists staff in every state with the right badges; search, Role, Status and the page live in the URL; the
// own row's pencil leads to My Profile and Back restores the search, the filter and the row; and an Admin who opens
// /admin/users is sent on to /admin. The shared CSPS_E2E database keeps every staff member earlier runs made (all named
// "E2E Staff"), so each check finds its person by their unique email and never counts the whole roster. Every test runs
// under the shared guard (console, page errors, CSP, failed responses).
import type { Page } from '@playwright/test';
import { signInAs } from './auth.ts';
import { expect, expectNoAxeViolations, test } from './fixtures.ts';
import { createInvitedStaff, createStaff } from './testing-api.ts';

/** True when the page does not scroll sideways (a page script: the node program has no DOM). */
const NO_SIDEWAYS_SCROLL = 'document.documentElement.scrollWidth <= window.innerWidth';

/** The roster's body rows (the phone layout stacks them as cards but keeps the same elements). */
function rows(page: Page) {
  return page.locator('tbody tr');
}

/** The roster's Search box (the top bar has a search box of its own, so the placeholder tells them apart). */
function searchBox(page: Page) {
  return page.getByPlaceholder('Name or email');
}

/** Types an email into Search and waits until the URL holds it, which is after the 300 ms debounce. */
async function searchFor(page: Page, text: string): Promise<void> {
  await searchBox(page).fill(text);
  await expect.poll(() => new URL(page.url()).searchParams.get('q')).toBe(text);
}

function query(page: Page): URLSearchParams {
  return new URL(page.url()).searchParams;
}

test('@users the roster shows staff in every state, filters and pages in the URL, and Back from My Profile restores it', async ({
  page,
  request,
  guard,
}) => {
  // One sign-in, a dozen made accounts and a long journey: WebKit under four parallel workers needs more than 30 seconds.
  test.setTimeout(150_000);
  // Opening the sign-in page asks the refresh cookie for a session first; with none that answer is a 401.
  guard.expectStatus('/api/v1/auth/refresh', 401);
  const manager = await createStaff(request, 'Manager');
  const deactivated = await createStaff(request, 'Admin', 'deactivated');
  const locked = await createStaff(request, 'Manager', 'manager-locked');
  const invited = await createInvitedStaff(request, 'Admin');
  const active = await createStaff(request, 'Admin');
  // Enough people for a second page at 10 a page, whatever earlier runs left behind.
  await Promise.all(Array.from({ length: 8 }, () => createStaff(request, 'Admin')));
  await signInAs(page, request, manager);

  // The page: header, title, table name and no sideways scroll; Users is the current sidebar item.
  await page.goto('/admin/users');
  await expect(page.getByRole('heading', { level: 1, name: 'Users' })).toBeVisible();
  await expect(page).toHaveTitle('Users · CSPS Admin');
  await expect(page.getByText('Manager only')).toBeVisible();
  await expect(page.getByRole('table', { name: 'Users' })).toBeAttached();
  await expect(page.locator('aside nav[aria-label="Admin"] a[aria-current="page"]')).toContainText('Users');
  await expect(
    page.getByText(
      "You can't lock, deactivate, demote or delete your own account. Locked and deactivated users can't sign in, but their records stay on orders and expenses.",
    ),
  ).toBeVisible();
  await expect(rows(page).first()).toBeVisible();
  expect(await page.evaluate(NO_SIDEWAYS_SCROLL)).toBe(true);
  await expectNoAxeViolations(page);

  // USER-01: each person's badges, found by their own email.
  await searchFor(page, active.email);
  await expect(rows(page)).toHaveCount(1);
  await expect(rows(page).first().locator('td[data-label="Status"]')).toHaveText('Active');
  await expect(rows(page).first().locator('td[data-label="Role"]')).toHaveText('Admin');
  await expect(rows(page).first().getByRole('link')).toHaveCount(0);
  await expect(rows(page).first().getByRole('button')).toHaveCount(0);

  await searchFor(page, deactivated.email);
  await expect(rows(page)).toHaveCount(1);
  await expect(rows(page).first().locator('td[data-label="Status"]')).toHaveText('Inactive');

  await searchFor(page, locked.email);
  await expect(rows(page)).toHaveCount(1);
  await expect(rows(page).first().locator('td[data-label="Status"]')).toHaveText('Locked');
  await expect(rows(page).first().locator('td[data-label="Role"]')).toHaveText('Manager');

  await searchFor(page, invited.email);
  await expect(rows(page)).toHaveCount(1);
  await expect(rows(page).first().locator('td[data-label="Status"]')).toContainText('Invite pending');
  await expectNoAxeViolations(page);

  // WEB-10: Role and Status are chips and URL parameters; a filter that matches nobody shows No matches.
  await searchFor(page, locked.email);
  await page.getByRole('combobox', { name: 'Role' }).selectOption('manager');
  await page.getByRole('combobox', { name: 'Status' }).selectOption('locked');
  await expect(page.getByText('Role: Manager')).toBeVisible();
  await expect(page.getByText('Status: Locked')).toBeVisible();
  await expect.poll(() => query(page).get('role')).toBe('manager');
  await expect.poll(() => query(page).get('status')).toBe('locked');
  await expect(rows(page)).toHaveCount(1);

  await page.getByRole('combobox', { name: 'Role' }).selectOption('admin');
  await expect(page.getByRole('heading', { name: 'No matches' })).toBeVisible();
  await expectNoAxeViolations(page);
  await page.getByRole('button', { name: 'Clear Filters' }).click();
  await expect.poll(() => page.url().includes('?')).toBe(false);
  await expect(page.getByText('Role: Manager')).toHaveCount(0);
  await expect(rows(page).first()).toBeVisible();

  // Page 2 with 10 a page is a link that reopens the same page; Previous and Next push history entries.
  await page.goto('/admin/users?size=10&page=2');
  await expect(page.getByRole('navigation', { name: 'Pagination' })).toContainText('Page 2 of');
  await expect(rows(page).first()).toBeVisible();
  await expect(page.getByRole('combobox', { name: 'Rows per page' })).toHaveValue('10');
  await page.getByRole('button', { name: 'Previous page' }).click();
  await expect.poll(() => query(page).get('page')).toBeNull();
  await expect(page.getByRole('navigation', { name: 'Pagination' })).toContainText('Page 1 of');
  await page.getByRole('button', { name: 'Next page' }).click();
  await expect.poll(() => query(page).get('page')).toBe('2');
  await page.goBack();
  await expect.poll(() => query(page).get('page')).toBeNull();
  expect(query(page).get('size')).toBe('10');

  // A bad link is cleaned up once and shows the first page.
  await page.goto('/admin/users?role=owner&status=bogus&page=0&size=9999');
  await expect(rows(page).first()).toBeVisible();
  await expect.poll(() => page.url().includes('?')).toBe(false);

  // D-19: the own row has one action, a link to My Profile; Back restores the search, the filter and the row.
  await searchFor(page, manager.email);
  await page.getByRole('combobox', { name: 'Role' }).selectOption('manager');
  await expect(rows(page)).toHaveCount(1);
  const own = rows(page).first();
  await expect(own).toContainText('You');
  await expect(own.getByRole('button')).toHaveCount(0);
  const profileLink = own.getByRole('link', { name: 'Edit your details in My Profile' });
  await expect(profileLink).toHaveAttribute('href', '/admin/profile');
  // The URL follows the select a moment later (nuqs writes it asynchronously), so wait for it before keeping it.
  await expect.poll(() => query(page).get('role')).toBe('manager');
  const before = page.url();
  await profileLink.click();
  await expect(page).toHaveURL(/\/admin\/profile/);
  await expect(page.getByRole('heading', { level: 2, name: 'Personal Information' })).toBeVisible();

  await page.goBack();
  await expect(page).toHaveURL(before);
  await expect(searchBox(page)).toHaveValue(manager.email);
  await expect(page.getByRole('combobox', { name: 'Role' })).toHaveValue('manager');
  await expect(page.getByText('Role: Manager')).toBeVisible();
  await expect(rows(page)).toHaveCount(1);
  await expect(rows(page).first()).toContainText('You');
});

test('@users the roster has no sideways scroll at 320 px and no axe violations in Espresso', async ({
  page,
  request,
  guard,
}) => {
  test.setTimeout(90_000);
  guard.expectStatus('/api/v1/auth/refresh', 401);
  const manager = await createStaff(request, 'Manager');
  await signInAs(page, request, manager);

  await page.setViewportSize({ width: 320, height: 800 });
  await page.goto('/admin/users');
  await expect(page.getByRole('heading', { level: 1, name: 'Users' })).toBeVisible();
  await expect(rows(page).first()).toBeVisible();
  await searchFor(page, manager.email);
  await page.getByRole('combobox', { name: 'Role' }).selectOption('manager');
  await page.getByRole('combobox', { name: 'Status' }).selectOption('active');
  await expect(rows(page)).toHaveCount(1);
  expect(await page.evaluate(NO_SIDEWAYS_SCROLL)).toBe(true);
  await expectNoAxeViolations(page);

  await page.getByRole('button', { name: 'Switch to dark mode' }).click();
  await expect(page.locator('[data-theme]').first()).toHaveAttribute('data-theme', 'dark');
  await expect(rows(page)).toHaveCount(1);
  expect(await page.evaluate(NO_SIDEWAYS_SCROLL)).toBe(true);
  await expectNoAxeViolations(page);
});

test('@users an Admin who opens /admin/users lands on /admin and the sidebar has no Users item', async ({
  page,
  request,
  guard,
}) => {
  test.setTimeout(90_000);
  guard.expectStatus('/api/v1/auth/refresh', 401);
  await signInAs(page, request, await createStaff(request, 'Admin'));

  await page.goto('/admin/users');

  // The route's loader sends an Admin to /admin; the roster never shows. (The e2e bundle's /admin is the Dashboard preview,
  // which belongs to the dev placeholder user, so the sidebar is checked on a real page below.)
  await expect(page).toHaveURL(/\/admin$/);
  await expect(page.getByRole('heading', { level: 1, name: 'Users' })).toHaveCount(0);
  await expect(page.getByRole('table', { name: 'Users' })).toHaveCount(0);

  await page.goto('/admin/sessions');
  await expect(page.getByRole('heading', { level: 1, name: 'Signed-in devices' })).toBeVisible();
  await expect(page.locator('nav[aria-label="Admin"] a', { hasText: 'Users' })).toHaveCount(0);
});

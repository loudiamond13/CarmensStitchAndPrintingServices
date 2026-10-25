// The Audit Log end to end (AUDIT-02, D-26..D-29, D-40, WEB-10; plan 05-33), in all five projects. A Manager deactivates a
// colleague in Users, finds that entry in the Audit Log by filtering Action and Done to, opens its detail (network prefix and
// browser family), widens the range to everything kept, goes to Users and comes Back with the filters and the page restored,
// and reaches the same filtered log from the Edit User panel's activity link. An Admin who opens /admin/audit-log is sent on to
// /admin. The shared CSPS_E2E database keeps every entry earlier runs made (all staff are named "E2E Staff"), so the person is
// picked by their user id and never counted by name. Every test runs under the shared guard (console, page errors, CSP, failed
// responses).
import { randomUUID } from 'node:crypto';
import type { APIRequestContext, Locator, Page } from '@playwright/test';
import { signInAs } from './auth.ts';
import { expect, expectNoAxeViolations, test } from './fixtures.ts';
import { createStaff } from './testing-api.ts';

/** True when the page does not scroll sideways (a page script: the node program has no DOM). */
const NO_SIDEWAYS_SCROLL = 'document.documentElement.scrollWidth <= window.innerWidth';

function query(page: Page): URLSearchParams {
  return new URL(page.url()).searchParams;
}

/** The log's body rows that hold an entry (each is followed by a hidden detail row, which has no Action cell). */
function entryRows(page: Page) {
  return page.locator('tbody tr', { has: page.locator('td[data-label="Action"]') });
}

/** Brings the first entry to the middle of the screen: on a phone a card behind the fixed tab bar reads to axe as an obscured target. */
async function centerFirstEntry(page: Page): Promise<void> {
  await page.evaluate(`document.querySelector('tbody td[data-label="Action"]')?.scrollIntoView({ block: 'center' })`);
}

/** The description-list value that follows a term inside one expanded detail. */
function detailValue(scope: Locator, term: string): Locator {
  return scope.locator('dt', { hasText: new RegExp(`^${term}$`) }).locator('xpath=following-sibling::dd[1]');
}

/** Presses a button from the keyboard: Safari does not focus a button on click, and the focus return is part of what is proved. */
async function press(page: Page, button: Locator): Promise<void> {
  await button.focus();
  await page.keyboard.press('Enter');
}

/**
 * Makes `count` audit entries without a sign-in: a reset request for an address no account has is logged as "Password reset
 * requested" and answers 202 like any other, so a journey that needs a second page of entries makes its own and does not
 * depend on what earlier test runs left in the shared database.
 */
async function makeResetRequests(request: APIRequestContext, count: number): Promise<void> {
  await Promise.all(
    Array.from({ length: count }, async () => {
      const response = await request.post('/api/v1/auth/password/forgot', {
        data: { email: `nobody-${randomUUID()}@csps.test` },
        headers: { 'Idempotency-Key': randomUUID() },
      });
      expect(response.status()).toBe(202);
    }),
  );
}

/** Opens the in-app Users page from the shell: the sidebar link on desktop, and on a phone the one in the navigation drawer. */
async function goToUsers(page: Page): Promise<void> {
  const link = page
    .getByRole('navigation', { name: 'Admin' })
    .getByRole('link', { name: /^Users/ })
    .first();
  if (!(await link.isVisible())) {
    await page.getByRole('button', { name: 'Open navigation' }).click();
  }
  await link.click();
  await expect(page.getByRole('heading', { level: 1, name: 'Users' })).toBeVisible();
}

test('@audit a Manager finds a deactivation by Action and Done to, reads its detail, widens the range, and Back from Users restores the filters', async ({
  page,
  request,
  guard,
}) => {
  // Two sign-ins' worth of setup, a deactivation and a long journey: WebKit under four parallel workers needs more than 30 seconds.
  test.setTimeout(180_000);
  // Opening the sign-in page asks the refresh cookie for a session first; with none that answer is a 401.
  guard.expectStatus('/api/v1/auth/refresh', 401);
  const manager = await createStaff(request, 'Manager');
  const person = await createStaff(request, 'Admin');
  const personId = person.userId.toLowerCase();
  await signInAs(page, request, manager);

  // A deactivation to find: the Manager deactivates the colleague in Users (USER-04 writes user.deactivated).
  await page.goto('/admin/users');
  await expect(page.getByRole('heading', { level: 1, name: 'Users' })).toBeVisible();
  await page.getByPlaceholder('Name or email').fill(person.email);
  const row = page.locator('tbody tr').first();
  await expect(page.locator('tbody tr')).toHaveCount(1);
  await press(page, row.getByRole('button', { name: 'Deactivate E2E', exact: true }));
  const dialog = page.getByRole('dialog', { name: 'Deactivate E2E Staff?' });
  await dialog.getByRole('button', { name: 'Deactivate User' }).click();
  await expect(page.getByText('User deactivated')).toBeVisible();
  await expect(row.locator('td[data-label="Status"]')).toHaveText('Inactive');

  // A1: the page, its header and the shell around it. Audit Log is the current sidebar item; nothing scrolls sideways.
  await page.goto('/admin/audit-log');
  await expect(page.getByRole('heading', { level: 1, name: 'Audit Log' })).toBeVisible();
  await expect(page).toHaveTitle('Audit Log · CSPS Admin');
  await expect(page.getByText('Manager only')).toBeVisible();
  await expect(
    page.getByText(
      'Every sign-in, security, staff account and expense change, newest first. Times are Manila time. Entries are kept for 8 months.',
    ),
  ).toBeVisible();
  await expect(page.locator('aside nav[aria-label="Admin"] a[aria-current="page"]')).toContainText('Audit Log');
  await expect(page.getByRole('table', { name: 'Audit log' })).toBeAttached();
  await expect(entryRows(page).first()).toBeVisible();
  // There is no export (D-29).
  await expect(page.getByRole('button', { name: /export|download/i })).toHaveCount(0);
  expect(await page.evaluate(NO_SIDEWAYS_SCROLL)).toBe(true);

  // D-26: Action and Done to are filters in the URL; the person is picked by id.
  await expect(page.getByLabel('Done to', { exact: true })).toBeEnabled();
  await page.getByLabel('Action', { exact: true }).selectOption('user.deactivated');
  await page.getByLabel('Done to', { exact: true }).selectOption(personId);
  await expect.poll(() => query(page).get('action')).toBe('user.deactivated');
  await expect.poll(() => query(page).get('target')).toBe(personId);
  await expect(page.getByText('Action: User deactivated')).toBeVisible();
  await expect(page.getByText('Done to: E2E Staff')).toBeVisible();
  // Never an email or a name in the address (T-05-92).
  expect(page.url()).not.toContain('@');
  expect(page.url()).not.toContain(encodeURIComponent('@'));
  expect(page.url()).not.toContain('E2E');

  // One entry, by the Manager: the label, the person and the time (a time element).
  await expect(entryRows(page)).toHaveCount(1);
  const entry = entryRows(page).first();
  await expect(entry.locator('td[data-label="Action"]')).toHaveText('User deactivated');
  await expect(entry.locator('td[data-label="Done by"]')).toContainText('E2E Staff');
  await expect(entry.locator('td[data-label="Done to"]')).toContainText('E2E Staff');
  await expect(entry.locator('td[data-label="When"] time')).toHaveAttribute('datetime', /^\d{4}-\d{2}-\d{2}T/);
  await expect(page.getByText('Showing 1 entry · newest first')).toBeVisible();
  await centerFirstEntry(page);
  await expectNoAxeViolations(page);

  // D-27: the toggle opens the detail, with the network prefix, the browser family and the reference.
  const toggle = entry.getByRole('button', { name: /^Show details for User deactivated, / });
  await expect(toggle).toHaveAttribute('aria-expanded', 'false');
  await press(page, toggle);
  const open = entry.getByRole('button', { name: /^Hide details for User deactivated, / });
  await expect(open).toHaveAttribute('aria-expanded', 'true');
  await expect(open).toBeFocused();
  const detail = page.locator(`#${(await open.getAttribute('aria-controls')) ?? 'missing'}`);
  await expect(detail).toBeVisible();
  await expect(detailValue(detail, 'IP address')).toHaveText(/\/(24|48)$/);
  await expect(detailValue(detail, 'Device')).toHaveText(/^(Chrome|Firefox|Safari|Edge|Other)$/);
  await expect(detailValue(detail, 'Reference')).toHaveText(/\S/);
  // The deactivation has nothing more to say (D-40), so there is no What changed line.
  await expect(detail.locator('dt', { hasText: 'What changed' })).toHaveCount(0);
  await centerFirstEntry(page);
  await expectNoAxeViolations(page);

  // D-26: Everything kept widens the range; the chip and the URL say so.
  await page.getByLabel('Date range', { exact: true }).selectOption('all');
  await expect.poll(() => query(page).get('range')).toBe('all');
  await expect(page.getByText('Range: Everything kept (8 months)')).toBeVisible();
  await expect(entryRows(page).first()).toBeVisible();

  // WEB-10: to Users and Back restores the filters and the range.
  await goToUsers(page);
  await page.goBack();
  await expect(page.getByRole('heading', { level: 1, name: 'Audit Log' })).toBeVisible();
  expect(query(page).get('action')).toBe('user.deactivated');
  expect(query(page).get('target')).toBe(personId);
  expect(query(page).get('range')).toBe('all');
  await expect(page.getByLabel('Action', { exact: true })).toHaveValue('user.deactivated');
  await expect(page.getByLabel('Done to', { exact: true })).toHaveValue(personId);
  await expect(page.getByLabel('Date range', { exact: true })).toHaveValue('all');
  await expect(entryRows(page)).toHaveCount(1);
});

test('@audit the page and the filters of a link survive a trip to Users and Back, and a bad link is cleaned up once', async ({
  page,
  request,
  guard,
}) => {
  test.setTimeout(150_000);
  guard.expectStatus('/api/v1/auth/refresh', 401);
  const manager = await createStaff(request, 'Manager');
  await signInAs(page, request, manager);

  // WEB-10: page 2 of everything kept, 10 a page, for one action (twelve of them made here, so a second page always exists).
  await makeResetRequests(request, 12);
  await page.goto('/admin/audit-log?action=auth.password-reset-requested&range=all&size=10&page=2');
  await expect(page.getByRole('navigation', { name: 'Pagination' })).toContainText('Page 2 of');
  await expect(entryRows(page).first()).toBeVisible();
  await expect(page.getByText('Action: Password reset requested')).toBeVisible();
  await goToUsers(page);
  await page.goBack();
  await expect(page.getByRole('heading', { level: 1, name: 'Audit Log' })).toBeVisible();
  await expect(page.getByRole('navigation', { name: 'Pagination' })).toContainText('Page 2 of');
  expect(query(page).get('page')).toBe('2');
  expect(query(page).get('size')).toBe('10');
  expect(query(page).get('range')).toBe('all');
  expect(query(page).get('action')).toBe('auth.password-reset-requested');
  await expect(page.getByLabel('Action', { exact: true })).toHaveValue('auth.password-reset-requested');

  // A bad link is cleaned up once and shows the default view: an email as the actor is dropped from the address.
  await page.goto('/admin/audit-log?actor=someone%40example.ph&action=orders.archived&range=forever&page=0');
  await expect(entryRows(page).first()).toBeVisible();
  await expect.poll(() => page.url().includes('?')).toBe(false);
});

test('@audit the Edit User panel links to the log filtered to that person, and a phone fits the expanded detail inside its card', async ({
  page,
  request,
  guard,
}) => {
  test.setTimeout(150_000);
  guard.expectStatus('/api/v1/auth/refresh', 401);
  const manager = await createStaff(request, 'Manager');
  const person = await createStaff(request, 'Admin');
  const personId = person.userId.toLowerCase();
  await signInAs(page, request, manager);

  // The Manager deactivates the colleague so the person has an entry of their own.
  await page.goto('/admin/users');
  await page.getByPlaceholder('Name or email').fill(person.email);
  await expect(page.locator('tbody tr')).toHaveCount(1);
  const row = page.locator('tbody tr').first();
  await press(page, row.getByRole('button', { name: 'Deactivate E2E', exact: true }));
  await page
    .getByRole('dialog', { name: 'Deactivate E2E Staff?' })
    .getByRole('button', { name: 'Deactivate User' })
    .click();
  await expect(row.locator('td[data-label="Status"]')).toHaveText('Inactive');

  // The activity link in the Edit User panel opens the log for that person across everything kept.
  await press(page, row.getByRole('button', { name: 'Edit E2E Staff', exact: true }));
  const panel = page.getByRole('dialog', { name: 'Edit User' });
  await panel.getByRole('link', { name: "See this user's activity in the audit log" }).click();
  await expect(page.getByRole('heading', { level: 1, name: 'Audit Log' })).toBeVisible();
  await expect.poll(() => query(page).get('target')).toBe(personId);
  expect(query(page).get('range')).toBe('all');
  await expect(page.getByLabel('Done to', { exact: true })).toHaveValue(personId);
  await expect(page.getByText('Done to: E2E Staff')).toBeVisible();
  const deactivated = entryRows(page).filter({ hasText: 'User deactivated' });
  await expect(deactivated).toHaveCount(1);

  // At 320 px nothing scrolls sideways, and the expanded detail stacks inside the row's card (term over value).
  await page.setViewportSize({ width: 320, height: 800 });
  expect(await page.evaluate(NO_SIDEWAYS_SCROLL)).toBe(true);
  await press(page, deactivated.getByRole('button', { name: /^Show details for User deactivated, / }));
  const detail = page.locator('tbody tr:not([hidden]) dl');
  await expect(detail).toBeVisible();
  const term = await detail.locator('dt', { hasText: 'Reference' }).boundingBox();
  const value = await detailValue(detail, 'Reference').boundingBox();
  expect(term).not.toBeNull();
  expect(value).not.toBeNull();
  expect(value?.y ?? 0).toBeGreaterThan((term?.y ?? 0) + (term?.height ?? 0) - 1);
  expect(await page.evaluate(NO_SIDEWAYS_SCROLL)).toBe(true);
  await expectNoAxeViolations(page);
});

test('@audit an Admin who opens /admin/audit-log is sent on to /admin and never sees the log', async ({
  page,
  request,
  guard,
}) => {
  guard.expectStatus('/api/v1/auth/refresh', 401);
  const admin = await createStaff(request, 'Admin');
  await signInAs(page, request, admin);

  await page.goto('/admin/audit-log');

  // The guard sends the Admin to /admin (the e2e bundle shows its preview there, a production bundle goes on to Signed-in
  // devices); the log never shows. The Admin's navigation has no Audit Log item: proved by the unit tests, since this bundle's
  // preview shell uses a placeholder Manager.
  await expect(page).toHaveURL(/\/admin(\/sessions)?$/);
  await expect(page.getByRole('heading', { level: 1, name: 'Audit Log' })).toHaveCount(0);
  await expect(page.getByRole('table', { name: 'Audit log' })).toHaveCount(0);
});

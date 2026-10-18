// The Users roster end to end (USER-01, USER-08, WEB-10, D-19; plan 05-20), in all five projects. A Manager signs in and
// the roster lists staff in every state with the right badges; search, Role, Status and the page live in the URL; the
// own row's pencil leads to My Profile and Back restores the search, the filter and the row; and an Admin who opens
// /admin/users is sent on to /admin. The shared CSPS_E2E database keeps every staff member earlier runs made (all named
// "E2E Staff"), so each check finds its person by their unique email and never counts the whole roster. Every test runs
// under the shared guard (console, page errors, CSP, failed responses).
// Plan 05-22 adds @users-add: a Manager adds a person by invitation (the person sets a password and signs in) and with a
// temporary password (shown once, copied, then replaced at the first sign-in), and the panel fits a 320 px phone.
import { randomUUID } from 'node:crypto';
import type { Page } from '@playwright/test';
import { codeFromEmail, signInAs, typeCode } from './auth.ts';
import { expect, expectNoAxeViolations, test } from './fixtures.ts';
import { createInvitedStaff, createStaff, latestEmail, readEmails } from './testing-api.ts';

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
  // On a phone the Add User button pushes this state down behind the fixed tab bar, which axe reads as an overlap.
  await page.evaluate(`document.querySelector('main h2')?.scrollIntoView({ block: 'center' })`);
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

// --- @users-add (plan 05-22) ---

const OWN_PASSWORD = 'Mabuhay#Tahi2026';
const COPY_FAILED = "Copy didn't work. Select the password and copy it yourself.";

/** A unique address for the person a test adds; the Testing sink takes mail for any address. */
function newPersonEmail(): string {
  return `ana-${randomUUID().slice(0, 8)}@csps.test`;
}

function addUserButton(page: Page) {
  return page.getByRole('button', { name: 'Add User' });
}

/** Opens the Add User panel from the Users page. */
async function openAddUser(page: Page) {
  await page.goto('/admin/users');
  await expect(page.getByRole('heading', { level: 1, name: 'Users' })).toBeVisible();
  // Opened from the keyboard: Safari does not focus a button on click, and the focus return is part of what is proved.
  await addUserButton(page).focus();
  await page.keyboard.press('Enter');
  const panel = page.getByRole('dialog', { name: 'Add User' });
  await expect(panel).toBeVisible();
  await expect(page.getByRole('textbox', { name: /^First name/ })).toBeFocused();
  return panel;
}

async function fillNewPerson(page: Page, email: string): Promise<void> {
  await page.getByRole('textbox', { name: /^First name/ }).fill('Ana');
  await page.getByRole('textbox', { name: /^Last name/ }).fill('Reyes');
  await page.getByRole('textbox', { name: /^Email/ }).fill(email);
}

test('@users-add a Manager adds a person by invitation, who sets a password and signs in', async ({
  page,
  request,
  guard,
}) => {
  test.setTimeout(120_000);
  // Opening a sign-in page, or a guarded page, asks the refresh cookie for a session first; with none that answer is a 401.
  guard.expectStatus('/api/v1/auth/refresh', 401);
  const manager = await createStaff(request, 'Manager');
  await signInAs(page, request, manager);
  const email = newPersonEmail();

  const panel = await openAddUser(page);
  await expect(panel.getByRole('radio', { name: 'Email an invitation' })).toBeChecked();
  await expect(panel.getByRole('radio', { name: 'Admin' })).toBeChecked();
  await expectNoAxeViolations(page);

  // Blank fields are refused in the browser, before any request.
  await panel.getByRole('button', { name: 'Create User' }).click();
  await expect(panel.getByText('Enter a first name.')).toBeVisible();
  await expect(panel.getByText('Enter their email.')).toBeVisible();
  await expectNoAxeViolations(page);

  await fillNewPerson(page, email);
  await panel.getByRole('button', { name: 'Create User' }).click();

  // D-12: the panel closes, focus is back on Add User, and the toast says the invitation works for 7 days.
  await expect(panel).toBeHidden();
  await expect(addUserButton(page)).toBeFocused();
  await expect(page.getByText('User created')).toBeVisible();
  await expect(page.getByText('Ana Reyes · Admin. We emailed them an invitation that works for 7 days.')).toBeVisible();

  // The roster read again: the new row says Invite pending.
  await searchFor(page, email);
  await expect(rows(page)).toHaveCount(1);
  await expect(rows(page).first().locator('td[data-label="Status"]')).toContainText('Invite pending');

  // The sink holds the invitation, which opens with who set the account up; its link leads to setting a password.
  const invitation = await latestEmail(request, email, { subject: 'Set up your CSPS staff account' });
  expect(invitation.text).toContain('set up your account.');
  const link = /\/admin\/accept-invite#token=[\w-]+/.exec(invitation.text)?.[0];
  if (link === undefined) {
    throw new Error('The invitation held no accept-invite link.');
  }

  // A different person: no session of the Manager is left in this browser.
  await page.context().clearCookies();
  await page.goto(link);
  await expect(page.getByRole('heading', { level: 1, name: 'Set your password' })).toBeVisible();
  await page.getByLabel('New password', { exact: true }).fill(OWN_PASSWORD);
  await page.getByLabel('Confirm new password').fill(OWN_PASSWORD);
  await page.getByRole('button', { name: 'Save Password' }).click();
  await expect(page.getByText('Your password is set. Sign in to continue.')).toBeVisible();

  const user = await signInAs(page, request, { userId: '', email, password: OWN_PASSWORD });
  expect(user).toMatchObject({ firstName: 'Ana', lastName: 'Reyes', role: 'Admin' });
});

test('@users-add a Manager adds a person with a temporary password, copies it once, and the person must replace it', async ({
  page,
  request,
  browserName,
  guard,
}) => {
  test.setTimeout(150_000);
  guard.expectStatus('/api/v1/auth/refresh', 401);
  const manager = await createStaff(request, 'Manager');
  await signInAs(page, request, manager);
  const email = newPersonEmail();

  const panel = await openAddUser(page);
  await fillNewPerson(page, email);
  await panel.getByRole('radio', { name: 'Manager' }).click();
  await panel.getByRole('radio', { name: 'Set a temporary password' }).check();

  // C-4: a random readable value, Word-Word-NNNN, that New Suggestion replaces with a different one.
  const field = panel.getByLabel('Temporary password', { exact: true });
  await expect(field).toHaveValue(/^[A-Z][a-z]+-[A-Z][a-z]+-\d{4}$/);
  const first = await field.inputValue();
  await panel.getByRole('button', { name: 'New Suggestion' }).click();
  await expect(field).not.toHaveValue(first);
  await expect(field).toHaveValue(/^[A-Z][a-z]+-[A-Z][a-z]+-\d{4}$/);
  const password = await field.inputValue();
  await expect(panel.getByText('They can sign in right away with a temporary password.')).toBeVisible();
  await expectNoAxeViolations(page);

  await panel.getByRole('button', { name: 'Create User' }).click();

  // D-14: the shown-once step, with focus on the read-only field holding the value.
  const shown = page.getByRole('dialog', { name: 'User created' });
  await expect(shown).toBeVisible();
  const shownField = shown.getByLabel('Temporary password for Ana');
  await expect(shownField).toBeFocused();
  await expect(shownField).toHaveValue(password);
  await expect(shownField).toHaveAttribute('readonly', '');
  await expect(shown.getByText("This is the only time you'll see this password.", { exact: false })).toBeVisible();
  await expect(shown.getByRole('button', { name: 'Done' })).toBeVisible();
  await expectNoAxeViolations(page);

  // Copy Password: Chromium is granted the clipboard and holds the value; the other engines accept either the copy or the
  // select-it-yourself message.
  if (browserName === 'chromium') {
    await page.context().grantPermissions(['clipboard-read', 'clipboard-write']);
  }
  await shown.getByRole('button', { name: 'Copy Password' }).click();
  if (browserName === 'chromium') {
    await expect(shown.getByRole('button', { name: 'Copied' })).toBeVisible();
    expect(await page.evaluate('navigator.clipboard.readText()')).toBe(password);
  } else {
    await expect(shown.getByRole('button', { name: 'Copied' }).or(shown.getByText(COPY_FAILED))).toBeVisible();
  }

  // Done closes it for good: focus is back on Add User, and the value is nowhere on the page.
  await shown.getByRole('button', { name: 'Done' }).click();
  await expect(shown).toBeHidden();
  await expect(addUserButton(page)).toBeFocused();
  const value = JSON.stringify(password);
  expect(
    await page.evaluate(
      `document.body.innerHTML.includes(${value}) || Array.from(document.querySelectorAll('input')).some((input) => input.value === ${value})`,
    ),
  ).toBe(false);

  // The roster shows the new Manager as Active, with no invitation badge, and no email was sent.
  await searchFor(page, email);
  await expect(rows(page)).toHaveCount(1);
  await expect(rows(page).first().locator('td[data-label="Status"]')).toHaveText('Active');
  await expect(rows(page).first().locator('td[data-label="Role"]')).toHaveText('Manager');
  expect(await readEmails(request, { to: email })).toHaveLength(0);

  // A different person signs in with the shown value: the emailed code first, then a new password before anything opens.
  await page.context().clearCookies();
  await page.goto('/admin/login');
  await page.getByLabel('Email').fill(email);
  await page.getByLabel('Password', { exact: true }).fill(password);
  await page.getByRole('button', { name: 'Sign In' }).click();
  await expect(page.getByRole('heading', { level: 1, name: 'Check your email' })).toBeVisible();
  const mail = await latestEmail(request, email, { subject: 'is your CSPS sign-in code' });
  await typeCode(page, codeFromEmail(mail));
  await page.getByRole('button', { name: 'Verify Code' }).click();
  await expect(page.getByRole('heading', { level: 1, name: 'Set a new password' })).toBeVisible();
  await page.getByLabel('New password', { exact: true }).fill(OWN_PASSWORD);
  await page.getByLabel('Confirm new password').fill(OWN_PASSWORD);
  await page.getByRole('button', { name: 'Save Password' }).click();
  await expect(page.getByRole('main')).toBeVisible();
  await expect(page.getByText('Password saved')).toBeVisible();
});

test('@users-add the panel fits a 320 px phone: it scrolls inside, the footer stays reachable and nothing scrolls sideways', async ({
  page,
  request,
  guard,
}) => {
  test.setTimeout(120_000);
  guard.expectStatus('/api/v1/auth/refresh', 401);
  await signInAs(page, request, await createStaff(request, 'Manager'));
  await page.setViewportSize({ width: 320, height: 568 });
  const email = newPersonEmail();

  const panel = await openAddUser(page);
  await fillNewPerson(page, email);
  await panel.getByRole('radio', { name: 'Set a temporary password' }).check();

  // The long access descriptions wrap beside the control and the rows grow; none is cut off.
  expect(
    await page.evaluate(
      `Array.from(document.querySelectorAll('[role="dialog"] fieldset label')).every((row) => row.scrollWidth <= row.clientWidth)`,
    ),
  ).toBe(true);
  expect(await page.evaluate(NO_SIDEWAYS_SCROLL)).toBe(true);
  expect(
    await page.evaluate(
      `(() => { const panel = document.querySelector('[role="dialog"]'); return panel !== null && panel.scrollWidth <= panel.clientWidth; })()`,
    ),
  ).toBe(true);
  // The page behind is locked while the panel is open; the panel body scrolls, and the footer button stays on screen.
  expect(await page.evaluate(`document.body.classList.contains('overflow-hidden')`)).toBe(true);
  await expect(panel.getByRole('button', { name: 'Create User' })).toBeInViewport();
  await panel.getByRole('button', { name: 'New Suggestion' }).scrollIntoViewIfNeeded();
  await expect(panel.getByRole('button', { name: 'New Suggestion' })).toBeInViewport();
  await expect(panel.getByRole('button', { name: 'Create User' })).toBeInViewport();
  await expectNoAxeViolations(page);

  await panel.getByRole('button', { name: 'Create User' }).click();
  const shown = page.getByRole('dialog', { name: 'User created' });
  await expect(shown).toBeVisible();
  expect(await page.evaluate(NO_SIDEWAYS_SCROLL)).toBe(true);
  await expect(shown.getByRole('button', { name: 'Done' })).toBeInViewport();
  await expect(shown.getByRole('button', { name: 'Copy Password' })).toBeInViewport();
  await expectNoAxeViolations(page);

  await shown.getByRole('button', { name: 'Done' }).click();
  await expect(shown).toBeHidden();
});

// The Users roster end to end (USER-01, USER-08, WEB-10, D-19; plan 05-20), in all five projects. A Manager signs in and
// the roster lists staff in every state with the right badges; search, Role, Status and the page live in the URL; the
// own row's pencil leads to My Profile and Back restores the search, the filter and the row; and an Admin who opens
// /admin/users is sent on to /admin. The shared CSPS_E2E database keeps every staff member earlier runs made (all named
// "E2E Staff"), so each check finds its person by their unique email and never counts the whole roster. Every test runs
// under the shared guard (console, page errors, CSP, failed responses).
// Plan 05-22 adds @users-add: a Manager adds a person by invitation (the person sets a password and signs in) and with a
// temporary password (shown once, copied, then replaced at the first sign-in), and the panel fits a 320 px phone.
// Plan 05-25 adds @users-edit: a Manager renames and promotes a person in one save, two pages meet the stale-save banner, and the
// Edit panel fits a 320 px phone with the email choice and Recorded by / Last changed by.
// Plan 05-28 adds @users-actions: Deactivate behind its confirm ends the person's session and Activate lets them sign in again,
// Delete removes the row and their access, a Manager's own row has no toggle or Delete, and the dialogs fit a 320 px phone.
// Plan 05-30 adds @users-access: lock and unlock, a temporary password shown once, a reset link, a resent invitation, the email
// choice (by link, cancelled, confirmed; at once) and the stacked dialogs at 320 px.
import { randomUUID } from 'node:crypto';
import type { Browser, Locator, Page } from '@playwright/test';
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
  // Another person's row has three buttons: Edit (05-25), the status toggle and Delete (05-28).
  await expect(rows(page).first().getByRole('button')).toHaveCount(3);

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

/** True while the shown password is still in the page markup or in any input. */
async function passwordOnPage(page: Page, password: string): Promise<boolean> {
  if ((await page.content()).includes(password)) {
    return true;
  }
  const values = await Promise.all((await page.locator('input').all()).map((input) => input.inputValue()));
  return values.includes(password);
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
  expect(await passwordOnPage(page, password)).toBe(false);

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

// --- @users-edit (plan 05-25) ---

/** Finds one person on the roster by their unique email and opens their Edit panel from the keyboard. */
async function openEdit(page: Page, email: string) {
  await page.goto('/admin/users');
  await expect(page.getByRole('heading', { level: 1, name: 'Users' })).toBeVisible();
  await searchFor(page, email);
  await expect(rows(page)).toHaveCount(1);
  const edit = rows(page)
    .first()
    .getByRole('button', { name: /^Edit / });
  // Opened from the keyboard: Safari does not focus a button on click, and the focus return is part of what is proved.
  await edit.focus();
  await page.keyboard.press('Enter');
  const panel = page.getByRole('dialog', { name: 'Edit User' });
  await expect(panel).toBeVisible();
  await expect(panel.getByRole('textbox', { name: /^First name/ })).toBeFocused();
  return { panel, edit };
}

/** The value beside a RecordMeta term, like "Last changed by". */
function recordMetaValue(panel: Locator, term: string) {
  return panel.getByText(term, { exact: true }).locator('xpath=following-sibling::dd');
}

test('@users-edit a Manager renames and promotes a person in one save, who is signed out elsewhere, and Last changed by names the Manager', async ({
  page,
  browser,
  baseURL,
  request,
  guard,
}) => {
  // Two sign-ins, a save and a second look in one test: WebKit under four parallel workers needs more than 30 seconds.
  test.setTimeout(150_000);
  guard.expectStatus('/api/v1/auth/refresh', 401);
  const manager = await createStaff(request, 'Manager');
  const person = await createStaff(request, 'Admin');

  // The person is signed in on another browser (its own cookies).
  const other = await browser.newContext({ baseURL: baseURL ?? 'https://localhost:5199', ignoreHTTPSErrors: true });
  try {
    const otherPage = await other.newPage();
    await signInAs(otherPage, request, person);
    const signedInManager = await signInAs(page, request, manager);

    const { panel, edit } = await openEdit(page, person.email);
    await expect(panel.getByRole('textbox', { name: /^First name/ })).toHaveValue('E2E');
    await expect(panel.getByRole('textbox', { name: /^Email/ })).toHaveValue(person.email);
    await expect(panel.getByRole('radio', { name: 'Admin' })).toBeChecked();
    await expect(recordMetaValue(panel, 'Recorded by')).toBeVisible();
    await expectNoAxeViolations(page);

    // USER-05: the sign-out note shows before saving, once the role differs; it names the person as saved.
    await panel.getByRole('textbox', { name: /^First name/ }).fill('Paulo');
    await panel.getByRole('textbox', { name: /^Last name/ }).fill('Renamed');
    await panel.getByRole('radio', { name: 'Manager' }).click();
    await expect(panel.getByText('Changing the role signs E2E out on every device.')).toBeVisible();
    await expect(panel.getByRole('group', { name: 'How this email change applies' })).toHaveCount(0);
    await expectNoAxeViolations(page);

    await panel.getByRole('button', { name: 'Save Changes' }).click();

    // The panel closes, focus is back on that row's Edit button, the roster reads again and the toast names the person.
    await expect(panel).toBeHidden();
    await expect(edit).toBeFocused();
    await expect(page.getByText('User updated')).toBeVisible();
    await expect(page.getByText('Paulo Renamed · Manager')).toBeVisible();
    await expect(rows(page).first()).toContainText('Paulo Renamed');
    await expect(rows(page).first().locator('td[data-label="Role"]')).toHaveText('Manager');

    // The role change signed the person out on every device. Opening the sign-in page asks the other browser's refresh cookie
    // for a session; a live session would go on to /admin, so the sign-in screen showing proves the cookie no longer works.
    await otherPage.goto('/admin/login');
    await expect(otherPage.getByRole('heading', { level: 1, name: 'Sign in' })).toBeVisible();
    await expect(otherPage).toHaveURL(/\/admin\/login$/);

    // Last changed by now names the Manager, read fresh on this open.
    await edit.focus();
    await page.keyboard.press('Enter');
    const again = page.getByRole('dialog', { name: 'Edit User' });
    await expect(again.getByRole('textbox', { name: /^First name/ })).toHaveValue('Paulo');
    await expect(recordMetaValue(again, 'Last changed by')).toContainText(
      `${signedInManager.firstName} ${signedInManager.lastName}`,
    );
    await expect(again.getByRole('link', { name: "See this user's activity in the audit log" })).toHaveAttribute(
      'href',
      `/admin/audit-log?target=${person.userId}&range=all`,
    );
    await expectNoAxeViolations(page);
  } finally {
    await other.close();
  }
});

test('@users-edit two pages editing the same person: the second save shows the conflict banner with the typed value kept, and Load Latest shows the first save', async ({
  page,
  request,
  guard,
}) => {
  test.setTimeout(150_000);
  guard.expectStatus('/api/v1/auth/refresh', 401);
  // The second page's stale save is refused with a 409 (D-20); that is the behavior under test.
  guard.expectStatus('/api/v1/users/', 409);
  const manager = await createStaff(request, 'Manager');
  const person = await createStaff(request, 'Admin');
  await signInAs(page, request, manager);

  // Both pages are the same Manager (one browser, two tabs) and open the same person at the same version.
  const second = await page.context().newPage();
  const first = await openEdit(page, person.email);
  const later = await openEdit(second, person.email);

  await first.panel.getByRole('textbox', { name: /^First name/ }).fill('Alpha');
  await first.panel.getByRole('button', { name: 'Save Changes' }).click();
  await expect(first.panel).toBeHidden();

  // The second page is now stale: its save keeps the typed value and offers Load Latest, which takes focus.
  const typed = later.panel.getByRole('textbox', { name: /^First name/ });
  await typed.fill('Beta');
  await later.panel.getByRole('button', { name: 'Save Changes' }).click();
  await expect(later.panel.getByText('This was changed by someone else.')).toBeVisible();
  await expect(later.panel.getByRole('button', { name: 'Load Latest' })).toBeFocused();
  await expect(typed).toHaveValue('Beta');
  await expectNoAxeViolations(second);

  // Load Latest brings the first save, drops the banner and puts the cursor on First name.
  await later.panel.getByRole('button', { name: 'Load Latest' }).click();
  await expect(typed).toHaveValue('Alpha');
  await expect(later.panel.getByText('This was changed by someone else.')).toBeHidden();
  await expect(typed).toBeFocused();
  await expect(later.panel.getByText('Latest version loaded. Make your changes again.')).toBeAttached();

  // Typing again and saving now goes through.
  await typed.fill('Gamma');
  await later.panel.getByRole('button', { name: 'Save Changes' }).click();
  await expect(later.panel).toBeHidden();
  await expect(rows(second).first()).toContainText('Gamma');
});

test('@users-edit the panel fits a 320 px phone: it scrolls inside, the footer stays reachable, the email choice and the record meta stack, and nothing scrolls sideways', async ({
  page,
  request,
  guard,
}) => {
  test.setTimeout(120_000);
  guard.expectStatus('/api/v1/auth/refresh', 401);
  await signInAs(page, request, await createStaff(request, 'Manager'));
  const person = await createStaff(request, 'Admin');
  await page.setViewportSize({ width: 320, height: 568 });

  const { panel } = await openEdit(page, person.email);
  // A different email brings the choice, whose long descriptions wrap beside the control.
  await panel.getByRole('textbox', { name: /^Email/ }).fill(`moved-${person.email}`);
  const choice = panel.getByRole('group', { name: 'How this email change applies' });
  await expect(choice).toBeVisible();
  await expect(choice.getByRole('radio', { name: 'Confirm by link' })).toBeChecked();

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
  await expect(panel.getByRole('button', { name: 'Save Changes' })).toBeInViewport();

  // The record meta sits at the bottom of the body: scrolled into view, each term is over its value.
  const term = panel.getByText('Recorded by', { exact: true });
  await term.scrollIntoViewIfNeeded();
  await expect(term).toBeInViewport();
  const termBox = await term.boundingBox();
  const valueBox = await recordMetaValue(panel, 'Recorded by').boundingBox();
  if (termBox === null || valueBox === null) {
    throw new Error('The record meta has no layout box.');
  }
  expect(valueBox.y).toBeGreaterThan(termBox.y);
  expect(Math.abs(valueBox.x - termBox.x)).toBeLessThan(2);
  await expect(panel.getByRole('button', { name: 'Save Changes' })).toBeInViewport();
  await expectNoAxeViolations(page);

  await panel.getByRole('button', { name: 'Cancel' }).click();
  await expect(panel).toBeHidden();
});

// --- @users-actions (plan 05-28) ---

/** Finds one person on the roster by their unique email and returns their row. */
async function findPerson(page: Page, email: string) {
  await page.goto('/admin/users');
  await expect(page.getByRole('heading', { level: 1, name: 'Users' })).toBeVisible();
  await searchFor(page, email);
  await expect(rows(page)).toHaveCount(1);
  return rows(page).first();
}

/** Presses a button from the keyboard: Safari does not focus a button on click, and the focus return is part of what is proved. */
async function press(page: Page, button: Locator): Promise<void> {
  await button.focus();
  await page.keyboard.press('Enter');
}

/** A second browser (its own cookies), for the person whose access a Manager changes. */
function otherBrowser(browser: Browser, baseURL: string | undefined) {
  return browser.newContext({ baseURL: baseURL ?? 'https://localhost:5199', ignoreHTTPSErrors: true });
}

test('@users-actions deactivating a signed-in colleague ends their session, and activating lets them sign in again', async ({
  page,
  browser,
  baseURL,
  request,
  guard,
}) => {
  // Three sign-ins and two dialogs in one test: WebKit under four parallel workers needs more than 30 seconds.
  test.setTimeout(180_000);
  guard.expectStatus('/api/v1/auth/refresh', 401);
  // The deactivated person's next request is refused with a 401 (USER-05); that is the behavior under test.
  guard.expectStatus('/api/v1/sessions', 401);
  const manager = await createStaff(request, 'Manager');
  const person = await createStaff(request, 'Admin');

  const other = await otherBrowser(browser, baseURL);
  try {
    const otherPage = await other.newPage();
    await signInAs(otherPage, request, person);
    await signInAs(page, request, manager);

    const row = await findPerson(page, person.email);
    const toggle = row.getByRole('button', { name: 'Deactivate E2E', exact: true });
    await expect(toggle).toHaveAttribute('title', 'Deactivate E2E');

    // OQ-3: the confirm names the person, says what happens and puts "Keep Active" in focus; Keep Active changes nothing.
    await press(page, toggle);
    const dialog = page.getByRole('dialog', { name: 'Deactivate E2E Staff?' });
    await expect(dialog).toBeVisible();
    await expect(dialog.getByRole('button', { name: 'Keep Active' })).toBeFocused();
    await expect(dialog).toContainText("They'll be signed out on every device and can't sign in.");
    await expectNoAxeViolations(page);
    await dialog.getByRole('button', { name: 'Keep Active' }).click();
    await expect(dialog).toBeHidden();
    await expect(toggle).toBeFocused();
    await expect(row.locator('td[data-label="Status"]')).toHaveText('Active');

    // Deactivate User: the row turns Inactive, the toggle flips to Activate and takes focus, and the toast says so.
    await press(page, toggle);
    await dialog.getByRole('button', { name: 'Deactivate User' }).click();
    await expect(dialog).toBeHidden();
    await expect(page.getByText('User deactivated')).toBeVisible();
    await expect(page.getByText('E2E Staff can no longer sign in.')).toBeVisible();
    await expect(row.locator('td[data-label="Status"]')).toHaveText('Inactive');
    const activate = row.getByRole('button', { name: 'Activate E2E', exact: true });
    await expect(activate).toBeFocused();
    await expectNoAxeViolations(page);

    // USER-05: the person's session ended at once. Their next move inside the app sends them to sign-in with the notice.
    await otherPage.locator('button[aria-haspopup="menu"]').click();
    await otherPage.getByRole('menuitem', { name: 'Signed-in Devices' }).click();
    await expect(otherPage.getByRole('heading', { level: 1, name: 'Sign in' })).toBeVisible();
    await expect(otherPage.getByText('Your session ended. Sign in again.')).toBeVisible();

    // Activate acts at once: no dialog, the toggle stays focused and flips, and the toast says they can sign in again.
    await press(page, activate);
    await expect(page.getByRole('dialog')).toHaveCount(0);
    await expect(page.getByText('User activated')).toBeVisible();
    await expect(page.getByText('E2E Staff can sign in again.')).toBeVisible();
    await expect(row.locator('td[data-label="Status"]')).toHaveText('Active');
    await expect(row.getByRole('button', { name: 'Deactivate E2E', exact: true })).toBeFocused();

    // The person signs in again with the same password.
    await signInAs(otherPage, request, person);
  } finally {
    await other.close();
  }
});

test('@users-actions deleting a colleague removes the row and ends their access, and a Manager can delete another Manager but not themselves', async ({
  page,
  browser,
  baseURL,
  request,
  guard,
}) => {
  test.setTimeout(180_000);
  guard.expectStatus('/api/v1/auth/refresh', 401);
  // The deleted person's sign-in is refused like any wrong password (D-09).
  guard.expectStatus('/api/v1/auth/sign-in', 401);
  const manager = await createStaff(request, 'Manager');
  const person = await createStaff(request, 'Admin');
  const colleague = await createStaff(request, 'Manager');

  const other = await otherBrowser(browser, baseURL);
  try {
    await signInAs(page, request, manager);

    const row = await findPerson(page, person.email);
    const trash = row.getByRole('button', { name: 'Delete E2E Staff', exact: true });
    await press(page, trash);

    // D-09: the shared confirm names the person, says what stays, and puts Cancel in focus; Cancel changes nothing.
    const dialog = page.getByRole('dialog', { name: 'Delete E2E Staff?' });
    await expect(dialog).toBeVisible();
    await expect(dialog.getByRole('button', { name: 'Cancel' })).toBeFocused();
    await expect(dialog).toContainText(
      "They won't be able to sign in. Orders and expenses they recorded stay, under their name. If they might come back, deactivate instead. This can't be undone.",
    );
    await expectNoAxeViolations(page);
    await dialog.getByRole('button', { name: 'Cancel' }).click();
    await expect(dialog).toBeHidden();
    await expect(trash).toBeFocused();
    await expect(rows(page)).toHaveCount(1);

    // Delete User: the row leaves; with nothing else listed, focus goes to the page heading; the toast names the person.
    await press(page, trash);
    await dialog.getByRole('button', { name: 'Delete User' }).click();
    await expect(dialog).toBeHidden();
    await expect(page.getByText('User deleted')).toBeVisible();
    await expect(rows(page)).toHaveCount(0);
    await expect(page.getByRole('heading', { level: 1, name: 'Users' })).toBeFocused();

    // They cannot sign in any more.
    const gonePage = await other.newPage();
    await gonePage.goto('/admin/login');
    await gonePage.getByLabel('Email').fill(person.email);
    await gonePage.getByLabel('Password', { exact: true }).fill(person.password);
    await gonePage.getByRole('button', { name: 'Sign In' }).click();
    await expect(gonePage.getByText('Email or password is incorrect.')).toBeVisible();

    // D-19: a Manager's own row has neither a status toggle nor Delete.
    const own = await findPerson(page, manager.email);
    await expect(own.getByRole('button')).toHaveCount(0);
    await expect(own.getByRole('link', { name: 'Edit your details in My Profile' })).toBeVisible();

    // Another Manager can be deleted while an active Manager remains (the guard allows it).
    const colleagueRow = await findPerson(page, colleague.email);
    await press(page, colleagueRow.getByRole('button', { name: 'Delete E2E Staff', exact: true }));
    await dialog.getByRole('button', { name: 'Delete User' }).click();
    await expect(dialog).toBeHidden();
    await expect(page.getByText('User deleted').first()).toBeVisible();
    await expect(rows(page)).toHaveCount(0);
  } finally {
    await other.close();
  }
});

test('@users-actions the Deactivate and Delete dialogs fit a 320 px phone and nothing scrolls sideways', async ({
  page,
  request,
  guard,
}) => {
  test.setTimeout(120_000);
  guard.expectStatus('/api/v1/auth/refresh', 401);
  await signInAs(page, request, await createStaff(request, 'Manager'));
  const person = await createStaff(request, 'Admin');
  await page.setViewportSize({ width: 320, height: 568 });

  const row = await findPerson(page, person.email);
  expect(await page.evaluate(NO_SIDEWAYS_SCROLL)).toBe(true);

  const deactivate = page.getByRole('dialog', { name: 'Deactivate E2E Staff?' });
  await press(page, row.getByRole('button', { name: 'Deactivate E2E', exact: true }));
  await expect(deactivate).toBeVisible();
  await expect(deactivate.getByRole('button', { name: 'Keep Active' })).toBeInViewport();
  await expect(deactivate.getByRole('button', { name: 'Deactivate User' })).toBeInViewport();
  expect(await page.evaluate(NO_SIDEWAYS_SCROLL)).toBe(true);
  expect(
    await page.evaluate(
      `(() => { const dialog = document.querySelector('[role="dialog"]'); return dialog !== null && dialog.getBoundingClientRect().right <= window.innerWidth; })()`,
    ),
  ).toBe(true);
  await expectNoAxeViolations(page);
  await deactivate.getByRole('button', { name: 'Keep Active' }).click();
  await expect(deactivate).toBeHidden();

  const remove = page.getByRole('dialog', { name: 'Delete E2E Staff?' });
  await press(page, row.getByRole('button', { name: 'Delete E2E Staff', exact: true }));
  await expect(remove).toBeVisible();
  await expect(remove.getByRole('button', { name: 'Cancel' })).toBeInViewport();
  await expect(remove.getByRole('button', { name: 'Delete User' })).toBeInViewport();
  expect(await page.evaluate(NO_SIDEWAYS_SCROLL)).toBe(true);
  expect(
    await page.evaluate(
      `(() => { const dialog = document.querySelector('[role="dialog"]'); return dialog !== null && dialog.getBoundingClientRect().right <= window.innerWidth; })()`,
    ),
  ).toBe(true);
  await expectNoAxeViolations(page);
  await remove.getByRole('button', { name: 'Cancel' }).click();
  await expect(remove).toBeHidden();
});

// --- @users-access (plan 05-30) ---

const RESET_PASSWORD = 'Sulat#Hilo2026';

/** The first link with a token in its fragment in an email's text part. */
function tokenLinkFrom(text: string): string {
  const match = /https?:\/\/[^\s"'<>]+#token=[^\s"'<>]+/.exec(text);
  if (match === null) {
    throw new Error('The email carries no link with a token.');
  }
  return match[0];
}

/** The id of the newest mail to an address in the sink, or 0 when it has none: later mail is found after it. */
async function cursorFor(request: Parameters<typeof readEmails>[0], to: string): Promise<number> {
  return (await readEmails(request, { to })).at(-1)?.id ?? 0;
}

test('@users-access a Manager locks a signed-in colleague, who is signed out, then unlocks them so they can sign in again', async ({
  page,
  browser,
  baseURL,
  request,
  guard,
}) => {
  test.setTimeout(240_000);
  guard.expectStatus('/api/v1/auth/refresh', 401);
  // The locked person's next request is refused with a 401 (USER-05); that is the behavior under test.
  guard.expectStatus('/api/v1/sessions', 401);
  const manager = await createStaff(request, 'Manager');
  const person = await createStaff(request, 'Admin');

  const other = await otherBrowser(browser, baseURL);
  try {
    const otherPage = await other.newPage();
    await signInAs(otherPage, request, person);
    await signInAs(page, request, manager);

    const { panel } = await openEdit(page, person.email);
    // U3: the section names what applies to an active person with a password, and nothing else.
    await expect(panel.getByRole('heading', { level: 3, name: 'Account access' })).toBeVisible();
    for (const name of ['Send Reset Link', 'Set Temporary Password', 'Lock']) {
      await expect(panel.getByRole('button', { name })).toBeVisible();
    }
    await expect(panel.getByRole('button', { name: 'Unlock' })).toHaveCount(0);
    await expect(panel.getByRole('button', { name: 'Resend Invitation' })).toHaveCount(0);

    // D-21: the buttons wait while the form is edited, with the hint.
    await panel.getByRole('textbox', { name: /^First name/ }).fill('Edited');
    await expect(panel.getByText('Save or discard your changes first.')).toBeVisible();
    await expect(panel.getByRole('button', { name: 'Lock' })).toHaveAttribute('aria-disabled', 'true');
    await expectNoAxeViolations(page);
    await panel.getByRole('textbox', { name: /^First name/ }).fill('E2E');
    await expect(panel.getByText('Save or discard your changes first.')).toHaveCount(0);

    // U4: the confirm names the person and puts "Keep Unlocked" in focus; Keep Unlocked changes nothing.
    const lock = panel.getByRole('button', { name: 'Lock', exact: true });
    await press(page, lock);
    const confirm = page.getByRole('dialog', { name: 'Lock E2E Staff?' });
    await expect(confirm).toBeVisible();
    await expect(confirm.getByRole('button', { name: 'Keep Unlocked' })).toBeFocused();
    await expect(confirm).toContainText(
      "They'll be signed out on every device and can't sign in until a Manager unlocks them.",
    );
    await expectNoAxeViolations(page);
    await confirm.getByRole('button', { name: 'Keep Unlocked' }).click();
    await expect(confirm).toBeHidden();
    await expect(lock).toBeFocused();

    // Lock User: the panel reloads, Unlock replaces Lock and takes focus, and the toast says so.
    await press(page, lock);
    await confirm.getByRole('button', { name: 'Lock User' }).click();
    await expect(confirm).toBeHidden();
    const unlock = panel.getByRole('button', { name: 'Unlock', exact: true });
    await expect(unlock).toBeFocused();
    await expect(page.getByText('User locked')).toBeVisible();
    await expect(page.getByText("E2E Staff is signed out and can't sign in until you unlock them.")).toBeVisible();
    await expect(panel.getByRole('button', { name: 'Lock', exact: true })).toHaveCount(0);
    await expect(panel.getByText('Locked', { exact: true })).toBeVisible();
    await expectNoAxeViolations(page);

    // USER-05: the person's session ended at once. Their next move inside the app sends them to sign-in with the notice.
    await otherPage.locator('button[aria-haspopup="menu"]').click();
    await otherPage.getByRole('menuitem', { name: 'Signed-in Devices' }).click();
    await expect(otherPage.getByRole('heading', { level: 1, name: 'Sign in' })).toBeVisible();
    await expect(otherPage.getByText('Your session ended. Sign in again.')).toBeVisible();

    // Unlock acts at once: no dialog, and the toast says they can sign in again.
    await press(page, unlock);
    await expect(page.getByText('User unlocked')).toBeVisible();
    await expect(page.getByText('E2E Staff can sign in again.')).toBeVisible();
    await expect(panel.getByRole('button', { name: 'Lock', exact: true })).toBeVisible();
    await expect(panel.getByRole('button', { name: 'Unlock', exact: true })).toHaveCount(0);
    await panel.getByRole('button', { name: 'Cancel' }).click();
    await expect(panel).toBeHidden();
    await expect(rows(page).first().locator('td[data-label="Status"]')).toHaveText('Active');

    await signInAs(otherPage, request, person);
  } finally {
    await other.close();
  }
});

test('@users-access a Manager sets a temporary password that is shown once and must be replaced, and sends a reset link that works once', async ({
  page,
  browser,
  baseURL,
  request,
  browserName,
  guard,
}) => {
  test.setTimeout(300_000);
  guard.expectStatus('/api/v1/auth/refresh', 401);
  const manager = await createStaff(request, 'Manager');
  const person = await createStaff(request, 'Admin');
  await signInAs(page, request, manager);
  const { panel } = await openEdit(page, person.email);

  // U5: stacked over the panel, a readable suggestion with the cursor in it.
  const trigger = panel.getByRole('button', { name: 'Set Temporary Password' });
  await press(page, trigger);
  const dialog = page.getByRole('dialog', { name: 'Set a temporary password' });
  await expect(dialog).toBeVisible();
  await expect(dialog.getByText('For E2E Staff')).toBeVisible();
  const field = dialog.getByLabel('Temporary password', { exact: true });
  await expect(field).toBeFocused();
  await expect(field).toHaveValue(/^[A-Z][a-z]+-[A-Z][a-z]+-\d{4}$/);
  await expect(
    dialog.getByText('This signs E2E out on every device and emails them that a Manager reset their password.', {
      exact: false,
    }),
  ).toBeVisible();
  await expectNoAxeViolations(page);

  // Esc closes only the dialog: the panel stays open and the trigger has focus again.
  await page.keyboard.press('Escape');
  await expect(dialog).toBeHidden();
  await expect(panel).toBeVisible();
  await expect(trigger).toBeFocused();

  await press(page, trigger);
  const password = await field.inputValue();
  await dialog.getByRole('button', { name: 'Set Password' }).click();

  // D-14: the shown-once step, with focus on the read-only field holding the value.
  const shown = page.getByRole('dialog', { name: 'Temporary password set' });
  await expect(shown).toBeVisible();
  const shownField = shown.getByLabel('Temporary password for E2E');
  await expect(shownField).toBeFocused();
  await expect(shownField).toHaveValue(password);
  await expect(shownField).toHaveAttribute('readonly', '');
  await expect(shown.getByText("This is the only time you'll see this password.", { exact: false })).toBeVisible();
  await expectNoAxeViolations(page);
  if (browserName === 'chromium') {
    await page.context().grantPermissions(['clipboard-read', 'clipboard-write']);
  }
  await shown.getByRole('button', { name: 'Copy Password' }).click();
  await expect(shown.getByRole('button', { name: 'Copied' }).or(shown.getByText(COPY_FAILED))).toBeVisible();

  // Done closes it for good: focus is back on the trigger, and the value is nowhere on the page.
  await shown.getByRole('button', { name: 'Done' }).click();
  await expect(shown).toBeHidden();
  await expect(trigger).toBeFocused();
  await expect.poll(() => passwordOnPage(page, password)).toBe(false);

  // The person signs in with the shown value in their own browser: the emailed code first, then a new password.
  const other = await otherBrowser(browser, baseURL);
  try {
    const otherPage = await other.newPage();
    await otherPage.goto('/admin/login');
    await otherPage.getByLabel('Email').fill(person.email);
    await otherPage.getByLabel('Password', { exact: true }).fill(password);
    await otherPage.getByRole('button', { name: 'Sign In' }).click();
    await expect(otherPage.getByRole('heading', { level: 1, name: 'Check your email' })).toBeVisible();
    const code = await latestEmail(request, person.email, { subject: 'is your CSPS sign-in code' });
    await typeCode(otherPage, codeFromEmail(code));
    await otherPage.getByRole('button', { name: 'Verify Code' }).click();
    await expect(otherPage.getByRole('heading', { level: 1, name: 'Set a new password' })).toBeVisible();
    await otherPage.getByLabel('New password', { exact: true }).fill(OWN_PASSWORD);
    await otherPage.getByLabel('Confirm new password').fill(OWN_PASSWORD);
    await otherPage.getByRole('button', { name: 'Save Password' }).click();
    await expect(otherPage.getByRole('main')).toBeVisible();
  } finally {
    await other.close();
  }

  // USER-07: a reset link at once; the toast says 30 minutes, the sink holds the link, and it works once.
  const cursor = await cursorFor(request, person.email);
  await press(page, panel.getByRole('button', { name: 'Send Reset Link' }));
  await expect(page.getByText('Reset link sent')).toBeVisible();
  await expect(page.getByText('We emailed E2E a link to set a new password. It works for 30 minutes.')).toBeVisible();
  const reset = await latestEmail(request, person.email, { subject: 'Reset your CSPS password', after: cursor });
  expect(reset.text).toContain('sent you this link');
  const link = tokenLinkFrom(reset.text);

  const fresh = await otherBrowser(browser, baseURL);
  try {
    const freshPage = await fresh.newPage();
    await freshPage.goto(link);
    await expect(freshPage.getByLabel('New password', { exact: true })).toBeVisible();
    await freshPage.getByLabel('New password', { exact: true }).fill(RESET_PASSWORD);
    await freshPage.getByLabel('Confirm new password').fill(RESET_PASSWORD);
    await freshPage.getByRole('button', { name: 'Save Password' }).click();
    await expect(freshPage.getByText('Your password was changed. Sign in with your new password.')).toBeVisible();
  } finally {
    await fresh.close();
  }
});

test('@users-access resending an invitation makes the new link work and the old one expire', async ({
  page,
  browser,
  baseURL,
  request,
  guard,
}) => {
  test.setTimeout(180_000);
  guard.expectStatus('/api/v1/auth/refresh', 401);
  const manager = await createStaff(request, 'Manager');
  const invited = await createInvitedStaff(request, 'Admin');
  await signInAs(page, request, manager);
  const { panel } = await openEdit(page, invited.email);

  await expect(panel.getByRole('button', { name: 'Resend Invitation' })).toBeVisible();
  await expect(panel.getByRole('button', { name: 'Send Reset Link' })).toHaveCount(0);
  const cursor = await cursorFor(request, invited.email);
  await press(page, panel.getByRole('button', { name: 'Resend Invitation' }));
  await expect(page.getByText('Invitation sent')).toBeVisible();
  await expect(
    page.getByText('We emailed E2E a new link. It works for 7 days, and the old link no longer works.'),
  ).toBeVisible();
  await expectNoAxeViolations(page);

  const mail = await latestEmail(request, invited.email, { subject: 'Set up your CSPS staff account', after: cursor });
  const fresh = /\/admin\/accept-invite#token=[\w-]+/.exec(mail.text)?.[0];
  if (fresh === undefined) {
    throw new Error('The invitation held no accept-invite link.');
  }
  expect(fresh).not.toContain(invited.inviteToken);

  // The old link is refused; the new one sets the password. Both open in a browser of their own.
  guard.expectStatus('/api/v1/auth/invite/check', 404);
  const other = await otherBrowser(browser, baseURL);
  try {
    const otherPage = await other.newPage();
    await otherPage.goto(`/admin/accept-invite#token=${invited.inviteToken}`);
    await expect(otherPage.getByRole('heading', { level: 1, name: 'This invite has expired' })).toBeVisible();
    // A page of its own: only the fragment differs, so the same page would not read the new link.
    const newPage = await other.newPage();
    await newPage.goto(fresh);
    await expect(newPage.getByRole('heading', { level: 1, name: 'Set your password' })).toBeVisible();
    await newPage.getByLabel('New password', { exact: true }).fill(OWN_PASSWORD);
    await newPage.getByLabel('Confirm new password').fill(OWN_PASSWORD);
    await newPage.getByRole('button', { name: 'Save Password' }).click();
    await expect(newPage.getByText('Your password is set. Sign in to continue.')).toBeVisible();
  } finally {
    await other.close();
  }
});

test("@users-access a Manager changes a colleague's email by link (pending, cancelled, then confirmed) and at once (signed out)", async ({
  page,
  browser,
  baseURL,
  request,
  guard,
}) => {
  test.setTimeout(360_000);
  guard.expectStatus('/api/v1/auth/refresh', 401);
  // The signed-out person's next request is refused with a 401 (USER-05).
  guard.expectStatus('/api/v1/sessions', 401);
  const manager = await createStaff(request, 'Manager');
  const byLink = await createStaff(request, 'Admin');
  const atOnce = await createStaff(request, 'Admin');
  await signInAs(page, request, manager);
  const confirmNote = "We'll email a confirmation link to the new address. The change applies when they open it.";

  // Confirm by link: the note follows the choice, the save leaves the sign-in alone and says the link was sent.
  const first = `moved-${randomUUID().slice(0, 8)}@csps.test`;
  const second = `moved-${randomUUID().slice(0, 8)}@csps.test`;
  let { panel } = await openEdit(page, byLink.email);
  await panel.getByRole('textbox', { name: /^Email/ }).fill(first);
  await expect(panel.getByRole('radio', { name: 'Confirm by link' })).toBeChecked();
  await expect(panel.getByText(confirmNote)).toBeVisible();
  await expectNoAxeViolations(page);
  await panel.getByRole('button', { name: 'Save Changes' }).click();
  await expect(panel).toBeHidden();
  await expect(page.getByText('User updated')).toBeVisible();
  await expect(
    page.getByText(`E2E Staff · Admin. Their email changes when they open the link sent to ${first}.`),
  ).toBeVisible();
  await expect(rows(page).first()).toContainText(byLink.email);

  // The waiting change shows on a fresh open and Cancel Email Change calls it off.
  ({ panel } = await openEdit(page, byLink.email));
  await expect(panel.getByText(`Waiting for confirmation at ${first}.`)).toBeVisible();
  await expectNoAxeViolations(page);
  await press(page, panel.getByRole('button', { name: 'Cancel Email Change' }));
  await expect(page.getByText('Email change canceled')).toBeVisible();
  await expect(page.getByText(`E2E keeps signing in with ${byLink.email}.`)).toBeVisible();
  await expect(panel.getByText('Waiting for confirmation at', { exact: false })).toHaveCount(0);
  await expect(panel.getByRole('textbox', { name: /^Email/ })).toBeFocused();

  // A second change is confirmed from the new inbox, after which only the new address signs in.
  await panel.getByRole('textbox', { name: /^Email/ }).fill(second);
  await panel.getByRole('button', { name: 'Save Changes' }).click();
  await expect(panel).toBeHidden();
  const mail = await latestEmail(request, second, { subject: 'Confirm your new CSPS email' });
  const other = await otherBrowser(browser, baseURL);
  try {
    const otherPage = await other.newPage();
    await otherPage.goto(tokenLinkFrom(mail.text));
    // An explicit press confirms it, so a mail scanner opening the link changes nothing.
    await otherPage.getByRole('button', { name: 'Confirm New Email' }).click();
    await expect(otherPage.getByRole('heading', { level: 1, name: 'Your email is changed' })).toBeVisible();
    await signInAs(otherPage, request, { userId: byLink.userId, email: second, password: byLink.password });
  } finally {
    await other.close();
  }

  // Save at once: the note says so, the email moves, the toast says they are signed out, and their session is gone.
  const third = `moved-${randomUUID().slice(0, 8)}@csps.test`;
  const away = await otherBrowser(browser, baseURL);
  try {
    const awayPage = await away.newPage();
    await signInAs(awayPage, request, atOnce);

    ({ panel } = await openEdit(page, atOnce.email));
    await panel.getByRole('textbox', { name: /^Email/ }).fill(third);
    await panel.getByRole('radio', { name: 'Save at once' }).click();
    await expect(
      panel.getByText(
        'The email changes as soon as you save. The old address gets a notice and E2E is signed out on every device.',
      ),
    ).toBeVisible();
    await expect(panel.getByText(confirmNote)).toHaveCount(0);
    await expectNoAxeViolations(page);
    await panel.getByRole('button', { name: 'Save Changes' }).click();
    await expect(panel).toBeHidden();
    await expect(
      page.getByText(`E2E Staff · Admin. Their email is now ${third} and they are signed out everywhere.`),
    ).toBeVisible();

    await awayPage.locator('button[aria-haspopup="menu"]').click();
    await awayPage.getByRole('menuitem', { name: 'Signed-in Devices' }).click();
    await expect(awayPage.getByRole('heading', { level: 1, name: 'Sign in' })).toBeVisible();
    await signInAs(awayPage, request, { userId: atOnce.userId, email: third, password: atOnce.password });
  } finally {
    await away.close();
  }
});

test('@users-access the Lock and Set a temporary password dialogs fit a 320 px phone stacked over the panel', async ({
  page,
  request,
  guard,
}) => {
  test.setTimeout(120_000);
  guard.expectStatus('/api/v1/auth/refresh', 401);
  await signInAs(page, request, await createStaff(request, 'Manager'));
  const person = await createStaff(request, 'Admin');
  await page.setViewportSize({ width: 320, height: 568 });

  const { panel } = await openEdit(page, person.email);
  // The section is below the form: scrolled into view, its heading and buttons fit the width.
  await panel.getByRole('heading', { level: 3, name: 'Account access' }).scrollIntoViewIfNeeded();
  await expect(panel.getByRole('button', { name: 'Lock', exact: true })).toBeInViewport();
  expect(await page.evaluate(NO_SIDEWAYS_SCROLL)).toBe(true);
  await expectNoAxeViolations(page);

  const lock = page.getByRole('dialog', { name: 'Lock E2E Staff?' });
  await press(page, panel.getByRole('button', { name: 'Lock', exact: true }));
  await expect(lock).toBeVisible();
  await expect(lock.getByRole('button', { name: 'Keep Unlocked' })).toBeInViewport();
  await expect(lock.getByRole('button', { name: 'Lock User' })).toBeInViewport();
  expect(await page.evaluate(NO_SIDEWAYS_SCROLL)).toBe(true);
  expect(
    await page.evaluate(
      `(() => { const dialogs = document.querySelectorAll('[role="dialog"]'); const top = dialogs[dialogs.length - 1]; return top !== undefined && top.getBoundingClientRect().right <= window.innerWidth; })()`,
    ),
  ).toBe(true);
  await expectNoAxeViolations(page);
  await lock.getByRole('button', { name: 'Keep Unlocked' }).click();
  await expect(lock).toBeHidden();

  const temporary = page.getByRole('dialog', { name: 'Set a temporary password' });
  await press(page, panel.getByRole('button', { name: 'Set Temporary Password' }));
  await expect(temporary).toBeVisible();
  await expect(temporary.getByRole('button', { name: 'Cancel' })).toBeInViewport();
  await expect(temporary.getByRole('button', { name: 'Set Password' })).toBeInViewport();
  expect(await page.evaluate(NO_SIDEWAYS_SCROLL)).toBe(true);
  expect(
    await page.evaluate(
      `(() => { const dialogs = document.querySelectorAll('[role="dialog"]'); const top = dialogs[dialogs.length - 1]; return top !== undefined && top.getBoundingClientRect().right <= window.innerWidth; })()`,
    ),
  ).toBe(true);
  await expectNoAxeViolations(page);
  await temporary.getByRole('button', { name: 'Cancel' }).click();
  await expect(temporary).toBeHidden();
});

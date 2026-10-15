// The must-set-a-new-password step end to end (D-13, D-18, D-22, AUTH-09; plan 04-31), in all five projects. An account with
// a temporary or a breached password signs in with the password and the emailed code, lands on S3 with no session, and
// gets one only when it saves a new password. Each test makes its own staff user.
import type { APIRequestContext, Page } from '@playwright/test';
import { codeFromEmail, typeCode } from './auth.ts';
import { expect, expectNoAxeViolations, test } from './fixtures.ts';
import { createStaff, latestEmail, type StaffState } from './testing-api.ts';

const NEW_PASSWORD = 'Mabuhay#Tahi2026';

/** Signs in through S1 and enters the emailed code on S2, then stops: the page is left wherever the server sent it. */
async function signInToCodeEntered(page: Page, request: APIRequestContext, state: StaffState): Promise<void> {
  const staff = await createStaff(request, 'Admin', state);
  await page.goto('/admin/login');
  await page.getByLabel('Email').fill(staff.email);
  await page.getByLabel('Password', { exact: true }).fill(staff.password);
  await page.getByRole('button', { name: 'Sign In' }).click();
  await expect(page.getByRole('heading', { level: 1, name: 'Check your email' })).toBeVisible();
  const mail = await latestEmail(request, staff.email, { subject: 'is your CSPS sign-in code' });
  await typeCode(page, codeFromEmail(mail));
  await page.getByRole('button', { name: 'Verify Code' }).click();
}

test('@auth-must-change a temporary password must be replaced before the admin app opens', async ({
  page,
  request,
  guard,
}) => {
  test.setTimeout(90_000);
  // Opening a sign-in page, or a guarded page, asks the refresh cookie for a session first; with none that answer is a 401.
  guard.expectStatus('/api/v1/auth/refresh', 401);
  await signInToCodeEntered(page, request, 'must-change-temporary');

  // D-13: S3, with no session behind it.
  await expect(page.getByRole('heading', { level: 1, name: 'Set a new password' })).toBeVisible();
  await expect(page).toHaveURL(/\/admin\/login\/new-password$/);
  await expect(
    page.getByText('You signed in with a temporary password. Choose your own password to continue.'),
  ).toBeVisible();
  await expect(page.getByLabel('New password', { exact: true })).toBeFocused();
  await expectNoAxeViolations(page);

  // The admin area is closed until the save: a second tab of the same browser is sent to sign in. (The e2e bundle's dev
  // previews answer /admin itself, so the guarded devices page stands in for the area.)
  const other = await page.context().newPage();
  await other.goto('/admin/sessions');
  await expect(other).toHaveURL(/\/admin\/login/);
  await other.close();

  await page.getByLabel('New password', { exact: true }).fill(NEW_PASSWORD);
  await page.getByLabel('Confirm new password').fill(NEW_PASSWORD);
  await page.getByRole('button', { name: 'Save Password' }).click();

  // The save issues the session: the shell opens with the success toast.
  await expect(page).toHaveURL(/\/admin(\/sessions)?$/);
  await expect(page.getByRole('main')).toBeVisible();
  await expect(page.getByText('Password saved')).toBeVisible();
  await expect(page.getByText("You're signed in. Use your new password next time.")).toBeVisible();
});

test('@auth-must-change a password found in a breach shows its own wording and is replaced the same way', async ({
  page,
  request,
  guard,
}) => {
  test.setTimeout(90_000);
  guard.expectStatus('/api/v1/auth/refresh', 401);
  await signInToCodeEntered(page, request, 'must-change-breach');

  await expect(page.getByRole('heading', { level: 1, name: 'Set a new password' })).toBeVisible();
  await expect(page.getByText('Your password appeared in a data breach. Set a new one.')).toBeVisible();
  await expectNoAxeViolations(page);

  await page.getByLabel('New password', { exact: true }).fill(NEW_PASSWORD);
  await page.getByLabel('Confirm new password').fill(NEW_PASSWORD);
  await page.getByRole('button', { name: 'Save Password' }).click();

  await expect(page).toHaveURL(/\/admin(\/sessions)?$/);
  await expect(page.getByRole('main')).toBeVisible();
  await expect(page.getByText('Password saved')).toBeVisible();
});

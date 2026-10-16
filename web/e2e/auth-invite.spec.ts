// Invite acceptance end to end (AUTH-12, D-29; plan 04-31), in all five projects. An invited staff member opens the invite
// link, sets a password, lands on S1 with the "password is set" notice and signs in with the emailed code.
import { signInAs } from './auth.ts';
import { expect, expectNoAxeViolations, test } from './fixtures.ts';
import { createInvitedStaff } from './testing-api.ts';

const PASSWORD = 'Mabuhay#Tahi2026';

test('@auth-invite an invited manager sets a password from the invite link and signs in', async ({
  page,
  request,
  guard,
}) => {
  // Two sign-in page loads ask the refresh cookie for a session first; with none that answer is a 401.
  guard.expectStatus('/api/v1/auth/refresh', 401);
  const invited = await createInvitedStaff(request, 'Manager');

  // The token is in the fragment and leaves the address bar at once (CWE-598).
  await page.goto(`/admin/accept-invite#token=${invited.inviteToken}`);
  await expect(page.getByRole('heading', { level: 1, name: 'Set your password' })).toBeVisible();
  await expect(page.getByLabel('New password', { exact: true })).toBeVisible();
  expect(page.url()).not.toContain('token');
  await expect(page.getByText('Welcome to CSPS Admin. Choose a password for', { exact: false })).toContainText(
    invited.email,
  );
  await expectNoAxeViolations(page);

  await page.getByLabel('New password', { exact: true }).fill(PASSWORD);
  await page.getByLabel('Confirm new password').fill(PASSWORD);
  await page.getByRole('button', { name: 'Save Password' }).click();

  // D-29: no session is issued; S1 says the password is set.
  await expect(page.getByRole('heading', { level: 1, name: 'Sign in' })).toBeVisible();
  await expect(page.getByText('Your password is set. Sign in to continue.')).toBeVisible();
  await expectNoAxeViolations(page);

  const user = await signInAs(page, request, { userId: invited.userId, email: invited.email, password: PASSWORD });
  expect(user.role).toBe('Manager');
});

test('@auth-invite the invite fails closed when the breach check cannot be reached, and a retry later works', async ({
  page,
  request,
  guard,
}) => {
  guard.expectStatus('/api/v1/auth/refresh', 401);
  // The breach-check stand-in treats this sample as an unreachable service (the answer is a plain 422).
  guard.expectStatus('/api/v1/auth/invite/accept', 422);
  const invited = await createInvitedStaff(request, 'Admin');

  await page.goto(`/admin/accept-invite#token=${invited.inviteToken}`);
  await expect(page.getByLabel('New password', { exact: true })).toBeVisible();
  await page.getByLabel('New password', { exact: true }).fill('Hibp-Down#2026');
  await page.getByLabel('Confirm new password').fill('Hibp-Down#2026');
  await page.getByRole('button', { name: 'Save Password' }).click();

  const banner = page.getByRole('alert');
  await expect(banner).toContainText("We couldn't check your password right now.");
  await expect(banner).toContainText('Wait a minute, then try again.');
  await expect(page.getByRole('button', { name: 'Save Password' })).toBeFocused();
  await expect(page.getByRole('heading', { level: 1, name: 'Set your password' })).toBeVisible();
  await expectNoAxeViolations(page);

  // Nothing was saved and the invite still works: a different password goes through.
  await page.getByLabel('New password', { exact: true }).fill(PASSWORD);
  await page.getByLabel('Confirm new password').fill(PASSWORD);
  await page.getByRole('button', { name: 'Save Password' }).click();
  await expect(page.getByText('Your password is set. Sign in to continue.')).toBeVisible();
});

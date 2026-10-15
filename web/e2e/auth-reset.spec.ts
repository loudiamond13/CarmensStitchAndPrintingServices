// Forgot and reset a password end to end (AUTH-08, AUTH-09, D-16, D-17, D-19; plan 04-28), in all five projects. A staff
// member signs in on one browser, then forgets the password on another, follows the emailed link, sets a new password and
// signs in with it. The first browser is signed out at its next refresh. Each test makes its own staff user.
import { codeFromEmail, signInAs, typeCode } from './auth.ts';
import { expect, expectNoAxeViolations, test } from './fixtures.ts';
import { createStaff, latestEmail, readEmails } from './testing-api.ts';

const NEW_PASSWORD = 'Mabuhay#Tahi2026';

/** The reset link in the text part of the reset email: the address with the token in its fragment. */
function resetLinkFrom(text: string): string {
  const match = /https?:\/\/[^\s"'<>]+#token=[^\s"'<>]+/.exec(text);
  if (match === null) {
    throw new Error('The reset email carries no link with a token.');
  }
  return match[0];
}

test('@auth-reset a forgotten password is reset from the emailed link and the old session ends', async ({
  page,
  browser,
  baseURL,
  request,
  guard,
}) => {
  // Opening a sign-in page asks the refresh cookie for a session first; with none that answer is a 401.
  guard.expectStatus('/api/v1/auth/refresh', 401);
  const staff = await createStaff(request, 'Manager');

  // The first browser holds a live session (a second browser context has its own cookies).
  const other = await browser.newContext({ baseURL, ignoreHTTPSErrors: true });
  try {
    const otherPage = await other.newPage();
    await signInAs(otherPage, request, staff);

    // S1 to S4: "Forgot password?" opens the request screen.
    await page.goto('/admin/login');
    await page.getByRole('link', { name: 'Forgot password?' }).click();
    await expect(page.getByRole('heading', { level: 1, name: 'Reset your password' })).toBeVisible();
    await expectNoAxeViolations(page);

    await page.getByLabel('Email').fill(staff.email);
    await page.getByRole('button', { name: 'Send Reset Link' }).click();
    const sent = page.getByRole('heading', { level: 1, name: 'Check your email' });
    await expect(sent).toBeVisible();
    await expect(sent).toBeFocused();
    await expect(page.getByText(staff.email)).toBeVisible();
    await expectNoAxeViolations(page);

    // The emailed link opens S5; the token leaves the address bar at once.
    const mail = await latestEmail(request, staff.email, { subject: 'Reset your CSPS password' });
    await page.goto(resetLinkFrom(mail.text));
    await expect(page.getByLabel('New password', { exact: true })).toBeVisible();
    await expect(page.getByText(staff.email)).toBeVisible();
    expect(page.url()).not.toContain('token');
    await expectNoAxeViolations(page);

    await page.getByLabel('New password', { exact: true }).fill(NEW_PASSWORD);
    await page.getByLabel('Confirm new password').fill(NEW_PASSWORD);
    await page.getByRole('button', { name: 'Save Password' }).click();

    // D-17: no automatic sign-in; S1 says the password changed.
    await expect(page.getByRole('heading', { level: 1, name: 'Sign in' })).toBeVisible();
    await expect(page.getByText('Your password was changed. Sign in with your new password.')).toBeVisible();

    // The new password and a fresh emailed code get in.
    const cursor = (await readEmails(request, { to: staff.email })).at(-1)?.id ?? 0;
    await page.getByLabel('Email').fill(staff.email);
    await page.getByLabel('Password', { exact: true }).fill(NEW_PASSWORD);
    await page.getByRole('button', { name: 'Sign In' }).click();
    await expect(page.getByRole('heading', { level: 1, name: 'Check your email' })).toBeVisible();
    const codeMail = await latestEmail(request, staff.email, { subject: 'is your CSPS sign-in code', after: cursor });
    const verified = page.waitForResponse((response) => response.url().endsWith('/api/v1/auth/two-factor/verify'));
    await typeCode(page, codeFromEmail(codeMail));
    await page.getByRole('button', { name: 'Verify Code' }).click();
    expect((await verified).status()).toBe(200);
    await expect(page).toHaveURL(/\/admin(\/sessions)?$/);

    // D-19: the other browser's session was revoked, so its next refresh ends in the sign-in screen.
    await otherPage.reload();
    await expect(otherPage.getByRole('heading', { level: 1, name: 'Sign in' })).toBeVisible();
  } finally {
    await other.close();
  }
});

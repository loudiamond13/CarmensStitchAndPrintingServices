// Change my sign-in email end to end (PROF-02, D-24, D-25, OR-3; plan 05-18), in all five projects. A staff member opens
// the Change Email dialog on My Profile, sends a confirmation link to a new address, opens the link from the Testing sink,
// confirms it on /admin/confirm-email and then signs in with the new address only. Each test makes its own staff users.
import { signInAs } from './auth.ts';
import { expect, expectNoAxeViolations, test } from './fixtures.ts';
import { createStaff, latestEmail } from './testing-api.ts';

/** The confirm link in the text part of the email: the address with the token in its fragment. */
function confirmLinkFrom(text: string): string {
  const match = /https?:\/\/[^\s"'<>]+#token=[^\s"'<>]+/.exec(text);
  if (match === null) {
    throw new Error('The email carries no link with a token.');
  }
  return match[0];
}

test('@profile-email a change of email is sent from the dialog, confirmed from the new inbox, and only the new address signs in', async ({
  page,
  browser,
  baseURL,
  request,
  guard,
}) => {
  // Two sign-ins, a dialog with three attempts and a confirmation in one test: WebKit under four parallel workers is slow.
  test.setTimeout(180_000);
  // Opening a sign-in page asks the refresh cookie for a session first; with none that answer is a 401.
  guard.expectStatus('/api/v1/auth/refresh', 401);
  // The server's answers for a taken address and a wrong password are 400s on purpose; the old address no longer signs in.
  guard.expectStatus('/api/v1/profile/email-change', 400);
  guard.expectStatus('/api/v1/auth/sign-in', 401);
  const staff = await createStaff(request, 'Manager');
  const other = await createStaff(request, 'Admin');
  const newEmail = `moved.${staff.userId.slice(0, 8)}@csps.test`.toLowerCase();
  await signInAs(page, request, staff);

  await page.goto('/admin/profile');
  const card = page.getByRole('region', { name: 'Sign-in Email' });
  await expect(card.getByRole('heading', { level: 2, name: 'Sign-in Email' })).toBeVisible();
  await expect(card).toContainText(staff.email);
  await card.getByRole('button', { name: 'Change Email' }).click();

  const dialog = page.getByRole('dialog', { name: 'Change your email' });
  const newEmailBox = dialog.getByRole('textbox', { name: 'New email' });
  const passwordBox = dialog.getByLabel('Current password');
  const send = dialog.getByRole('button', { name: 'Send Confirmation Link' });
  await expect(newEmailBox).toBeFocused();
  await expectNoAxeViolations(page);

  // OR-3: the browser refuses the current address, in any letter case, before any request.
  await newEmailBox.fill(staff.email.toUpperCase());
  await passwordBox.fill(staff.password);
  await send.click();
  await expect(dialog.getByText('This is already your email.')).toBeVisible();
  await expect(newEmailBox).toBeFocused();
  await expectNoAxeViolations(page);

  // The server's answers come back under their own fields: another account's address, then a wrong password.
  await newEmailBox.fill(other.email);
  await send.click();
  await expect(dialog.getByText('Another account already uses this email.')).toBeVisible();
  await expect(newEmailBox).toBeFocused();

  await newEmailBox.fill(newEmail);
  await passwordBox.fill(`${staff.password}x`);
  await send.click();
  await expect(dialog.getByText('Your current password is incorrect.')).toBeVisible();
  await expect(passwordBox).toBeFocused();

  // The right password sends the link (Enter in a field submits the form): the dialog closes, the card shows the note with focus on it, and a toast says so.
  await passwordBox.fill(staff.password);
  await passwordBox.press('Enter');
  await expect(dialog).toBeHidden();
  await expect(page.getByText('Confirmation link sent')).toBeVisible();
  await expect(card).toContainText(
    `Waiting for confirmation at ${newEmail}. Until then, you sign in with ${staff.email}.`,
  );
  await expect(card.getByRole('button', { name: 'Resend Link' })).toBeVisible();
  await expect(card.getByRole('button', { name: 'Cancel Change' })).toBeVisible();
  await expect(card.getByRole('button', { name: 'Change Email' })).toHaveCount(0);
  await expect(page.locator(':focus')).toContainText('Waiting for confirmation at');
  await expectNoAxeViolations(page);

  // The link goes to the new inbox and a notice to the current one.
  const mail = await latestEmail(request, newEmail, { subject: 'Confirm your new CSPS email' });
  await latestEmail(request, staff.email, { subject: 'Your CSPS email is being changed' });

  // The new inbox's owner opens the link and presses the button (an explicit press, so a mail scanner changes nothing).
  await page.goto(confirmLinkFrom(mail.text));
  const confirm = page.getByRole('button', { name: 'Confirm New Email' });
  await expect(confirm).toBeVisible();
  // The token leaves the address bar once the page has read it.
  expect(page.url()).not.toContain('token');
  await confirm.click();
  await expect(page.getByRole('heading', { level: 1, name: 'Your email is changed' })).toBeVisible();
  await expectNoAxeViolations(page);

  // Only the new address signs in, in a fresh browser.
  const fresh = await browser.newContext({ baseURL: baseURL ?? 'https://localhost:5199', ignoreHTTPSErrors: true });
  try {
    const freshPage = await fresh.newPage();
    await freshPage.goto('/admin/login');
    await freshPage.getByLabel('Email').fill(staff.email);
    await freshPage.getByLabel('Password', { exact: true }).fill(staff.password);
    await freshPage.getByRole('button', { name: 'Sign In' }).click();
    await expect(freshPage.getByText('Email or password is incorrect.')).toBeVisible();

    await signInAs(freshPage, request, { ...staff, email: newEmail });
    await freshPage.goto('/admin/profile');
    await expect(freshPage.getByText(`${newEmail} · Member since `)).toBeVisible();
    await expect(freshPage.getByRole('region', { name: 'Sign-in Email' })).not.toContainText(
      'Waiting for confirmation',
    );
  } finally {
    await fresh.close();
  }
});

test('@profile-email Resend Link and Cancel Change act on the waiting change', async ({ page, request, guard }) => {
  test.setTimeout(150_000);
  guard.expectStatus('/api/v1/auth/refresh', 401);
  const staff = await createStaff(request, 'Manager');
  const newEmail = `waiting.${staff.userId.slice(0, 8)}@csps.test`.toLowerCase();
  await signInAs(page, request, staff);

  await page.goto('/admin/profile');
  const card = page.getByRole('region', { name: 'Sign-in Email' });
  await card.getByRole('button', { name: 'Change Email' }).click();
  const dialog = page.getByRole('dialog', { name: 'Change your email' });
  await dialog.getByRole('textbox', { name: 'New email' }).fill(newEmail);
  await dialog.getByLabel('Current password').fill(staff.password);
  await dialog.getByRole('button', { name: 'Send Confirmation Link' }).click();
  await expect(dialog).toBeHidden();
  const first = await latestEmail(request, newEmail, { subject: 'Confirm your new CSPS email' });

  // Resend sends a fresh link to the same address (and kills the older one).
  await card.getByRole('button', { name: 'Resend Link' }).click();
  await expect(page.getByText('Link sent again')).toBeVisible();
  const second = await latestEmail(request, newEmail, { subject: 'Confirm your new CSPS email', after: first.id });
  expect(confirmLinkFrom(second.text)).not.toBe(confirmLinkFrom(first.text));

  // A reload still shows the waiting change (it comes from the server).
  await page.reload();
  await expect(card).toContainText(`Waiting for confirmation at ${newEmail}.`);

  // Cancel Change calls it off: the button comes back with focus, and the link no longer works.
  await card.getByRole('button', { name: 'Cancel Change' }).click();
  await expect(page.getByText('Email change canceled')).toBeVisible();
  await expect(page.getByText(`You still sign in with ${staff.email}.`)).toBeVisible();
  await expect(card.getByRole('button', { name: 'Change Email' })).toBeFocused();
  await expect(card).not.toContainText('Waiting for confirmation');
  await expectNoAxeViolations(page);

  guard.expectStatus('/api/v1/profile/email-change/check', 404);
  await page.goto(confirmLinkFrom(second.text));
  await expect(page.getByRole('heading', { level: 1, name: 'This link has expired' })).toBeVisible();
});

const NEW_PASSWORD = 'Bagong#Landas2027';

test('@profile-password a password change on one device signs out the other, keeps this one, and only the new password signs in', async ({
  page,
  browser,
  baseURL,
  request,
  guard,
}) => {
  // Three sign-ins and a password change in one test: WebKit under four parallel workers is slow.
  test.setTimeout(180_000);
  // Opening a sign-in page asks the refresh cookie for a session first; with none that answer is a 401.
  guard.expectStatus('/api/v1/auth/refresh', 401);
  // A wrong current password is a 400 on purpose; the other device's next request and the old password are 401s.
  guard.expectStatus('/api/v1/profile/password', 400);
  guard.expectStatus('/api/v1/sessions', 401);
  guard.expectStatus('/api/v1/profile', 401);
  guard.expectStatus('/api/v1/auth/sign-in', 401);
  const staff = await createStaff(request, 'Manager');

  const other = await browser.newContext({ baseURL: baseURL ?? 'https://localhost:5199', ignoreHTTPSErrors: true });
  const fresh = await browser.newContext({ baseURL: baseURL ?? 'https://localhost:5199', ignoreHTTPSErrors: true });
  try {
    await signInAs(page, request, staff);
    const otherPage = await other.newPage();
    await signInAs(otherPage, request, staff);
    await otherPage.goto('/admin/profile?tab=security');
    await expect(otherPage.getByRole('heading', { level: 2, name: 'Signed-in Devices' })).toBeVisible();

    // SEC-06: the change is covered by the Idempotency-Key gate, so each attempt carries a key.
    const keys: (string | undefined)[] = [];
    page.on('request', (sent) => {
      if (sent.method() === 'POST' && new URL(sent.url()).pathname.endsWith('/api/v1/profile/password')) {
        keys.push(sent.headers()['idempotency-key']);
      }
    });

    await page.goto('/admin/profile?tab=security');
    const card = page.getByRole('form', { name: 'Change Password' });
    const current = card.getByLabel('Current password');
    const next = card.getByLabel('New password', { exact: true });
    const confirm = card.getByLabel('Confirm new password');
    const update = card.getByRole('button', { name: 'Update Password' });
    await expect(card.getByText('Use 8+ characters with a number and a symbol.')).toBeVisible();
    await expectNoAxeViolations(page);

    // OR-3: every rule is checked in the browser first, so nothing is sent for these.
    await update.click();
    await expect(card.getByText('Enter your current password.')).toBeVisible();
    await expect(card.getByText('Enter a new password.')).toBeVisible();
    await expect(card.getByText('Enter the new password again.')).toBeVisible();
    await expect(current).toBeFocused();
    // From the top of the page: on a phone the sticky bars would otherwise cover the field that took focus.
    await page.evaluate('window.scrollTo(0, 0)');
    await expectNoAxeViolations(page);
    await current.fill(staff.password);
    await next.fill('Staff#2027!');
    await confirm.fill('Staff#2027!');
    await update.click();
    await expect(card.getByText("Don't use your name or email in your password.")).toBeVisible();
    await next.fill(NEW_PASSWORD);
    await confirm.fill(`${NEW_PASSWORD}!`);
    await update.click();
    await expect(card.getByText("Passwords don't match.")).toBeVisible();
    expect(keys).toHaveLength(0);

    // A wrong current password comes back from the server under its field, with the cursor there.
    await current.fill(`${staff.password}x`);
    await confirm.fill(NEW_PASSWORD);
    await update.click();
    await expect(card.getByText('Your current password is incorrect.')).toBeVisible();
    await expect(current).toBeFocused();

    // The right one changes the password: the form is cleared and the toast says the other devices were signed out.
    await current.fill(staff.password);
    await confirm.press('Enter');
    await expect(page.getByText('Password updated')).toBeVisible();
    await expect(
      page.getByText('Use your new password next time you sign in. Your other devices were signed out.'),
    ).toBeVisible();
    await expect(current).toHaveValue('');
    await expect(next).toHaveValue('');
    await expect(confirm).toHaveValue('');
    expect(keys).toHaveLength(2);
    expect(keys.every((key) => key !== undefined && key !== '')).toBe(true);
    await page.evaluate('window.scrollTo(0, 0)');
    await expectNoAxeViolations(page);

    // This device stays signed in, also after a reload.
    await page.reload();
    await expect(page.getByRole('heading', { level: 2, name: 'Change Password' })).toBeVisible();

    // The other device's next request is refused, and it lands on sign-in with the session-ended notice.
    await otherPage.getByRole('link', { name: 'View Signed-in Devices' }).click();
    await expect(otherPage.getByRole('heading', { level: 1, name: 'Sign in' })).toBeVisible();
    await expect(otherPage.getByText('Your session ended. Sign in again.')).toBeVisible();

    // Only the new password signs in, in a fresh browser.
    const freshPage = await fresh.newPage();
    await freshPage.goto('/admin/login');
    await freshPage.getByLabel('Email').fill(staff.email);
    await freshPage.getByLabel('Password', { exact: true }).fill(staff.password);
    await freshPage.getByRole('button', { name: 'Sign In' }).click();
    await expect(freshPage.getByText('Email or password is incorrect.')).toBeVisible();
    await signInAs(freshPage, request, { ...staff, password: NEW_PASSWORD });
  } finally {
    await other.close();
    await fresh.close();
  }
});

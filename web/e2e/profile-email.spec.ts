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

  // The right password sends the link: the dialog closes, the card shows the note with focus on it, and a toast says so.
  await passwordBox.fill(staff.password);
  await send.click();
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
  expect(page.url()).not.toContain('token');
  await page.getByRole('button', { name: 'Confirm New Email' }).click();
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
    await expect(freshPage.getByRole('region', { name: 'Sign-in Email' })).not.toContainText('Waiting for confirmation');
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

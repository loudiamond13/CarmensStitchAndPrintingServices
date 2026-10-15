// Sign-in end to end (AUTH-02, AUTH-04, D-01; plan 04-27): a staff member signs in on S1, reads the 6-digit code from the
// Testing sink, enters it on S2 and reaches the admin shell, in all five projects. Each test makes its own staff user.
import { expect, expectNoAxeViolations, test } from './fixtures.ts';
import { signInAs } from './auth.ts';
import { createStaff } from './testing-api.ts';

test('@auth a staff member signs in with the emailed code and stays signed in across a reload', async ({
  page,
  request,
  guard,
}) => {
  // Opening the sign-in page asks the refresh cookie for a session first; with none, that answer is a 401.
  guard.expectStatus('/api/v1/auth/refresh', 401);
  const staff = await createStaff(request, 'Manager');

  await page.goto('/admin/login');
  await expect(page.getByRole('heading', { level: 1, name: 'Sign in' })).toBeVisible();
  await expectNoAxeViolations(page);

  const user = await signInAs(page, request, staff);
  expect(user).toEqual({ firstName: 'E2E', lastName: 'Staff', role: 'Manager' });
  await expect(page).toHaveURL(/\/admin$/);

  // A reload keeps the shell, and the sign-in page now sends the visitor on to /admin because the refresh cookie
  // still holds the session.
  await page.reload();
  await expect(page.getByRole('main')).toBeVisible();
  await page.goto('/admin/login');
  await expect(page).toHaveURL(/\/admin$/);
});

test('@auth the code step names the typed email and never submits by itself', async ({ page, request, guard }) => {
  guard.expectStatus('/api/v1/auth/refresh', 401);
  const staff = await createStaff(request, 'Admin');

  await page.goto('/admin/login');
  await page.getByLabel('Email').fill(staff.email);
  await page.getByLabel('Password', { exact: true }).fill(staff.password);
  await page.getByRole('button', { name: 'Sign In' }).click();

  await expect(page.getByRole('heading', { level: 1, name: 'Check your email' })).toBeVisible();
  await expect(page.getByText(staff.email)).toBeVisible();
  await expect(page.getByLabel('Digit 1 of 6')).toHaveAttribute('autocomplete', 'one-time-code');
  await expectNoAxeViolations(page);

  // Six digits typed: nothing is sent until Verify Code is pressed (WCAG 3.2.2).
  await page.getByLabel('Digit 1 of 6').click();
  await page.keyboard.type('000000');
  await expect(page.getByLabel('Digit 6 of 6')).toHaveValue('0');
  await expect(page.getByRole('heading', { level: 1, name: 'Check your email' })).toBeVisible();
});

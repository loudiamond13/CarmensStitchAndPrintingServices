// The dashboard header end to end (DASH-01, DASH-06; plan 10-07), in all five projects. A fresh signed-in Manager or Admin lands
// on /admin and sees "Good {part}, {first name}" and the business date from the server, with View Orders and New Order, and no
// dev preview. Every test runs under the shared guard (console, page errors, CSP, failed responses). The shared CSPS_E2E database
// holds what other specs made, so nothing here asserts a shop-wide figure (RESEARCH Pitfall 11).
import { dashboardHeading, signInAs } from './auth.ts';
import { expect, expectNoAxeViolations, test } from './fixtures.ts';
import { createStaff } from './testing-api.ts';

/** "Wednesday, Nov 4, 2026 · Here's how the shop is doing this month." */
const SUBLINE =
  /^(Monday|Tuesday|Wednesday|Thursday|Friday|Saturday|Sunday), [A-Z][a-z]{2} \d{1,2}, \d{4} · Here's how the shop is doing this month\.$/;

test('@dashboard a Manager signs in and lands on the dashboard with the greeting, the date and the two actions, clean in Blush and Espresso', async ({
  page,
  request,
  guard,
}) => {
  // Opening the sign-in page asks the refresh cookie for a session first; with none that answer is a 401.
  guard.expectStatus('/api/v1/auth/refresh', 401);
  const user = await signInAs(page, request, await createStaff(request, 'Manager'));

  await expect(page).toHaveURL(/\/admin$/);
  await expect(page.locator('h1')).toHaveCount(1);
  await expect(page.locator('h1')).toHaveText(dashboardHeading(user));
  await expect(page).toHaveTitle('Dashboard · CSPS Admin');
  await expect(page.getByText(SUBLINE)).toBeVisible();
  await expect(page.getByText('Development only. This screen is built in a later phase.')).toHaveCount(0);
  await expect(page.getByRole('link', { name: 'View Orders' })).toHaveAttribute('href', '/admin/orders');
  await expect(page.getByRole('link', { name: 'New Order' })).toHaveAttribute('href', '/admin/orders/new');
  await expect(page.locator('aside nav[aria-label="Admin"] a[aria-current="page"]')).toContainText('Dashboard');

  await expect(page.locator('[data-theme]').first()).toHaveAttribute('data-theme', 'light');
  await expectNoAxeViolations(page);

  await page.getByRole('button', { name: 'Switch to dark mode' }).click();
  await expect(page.locator('[data-theme]').first()).toHaveAttribute('data-theme', 'dark');
  await expectNoAxeViolations(page);
});

test('@dashboard an Admin lands on the dashboard too, and View Orders opens the Orders page in the same document', async ({
  page,
  request,
  guard,
}) => {
  guard.expectStatus('/api/v1/auth/refresh', 401);
  const user = await signInAs(page, request, await createStaff(request, 'Admin'));
  await expect(page.locator('h1')).toHaveText(dashboardHeading(user));
  await page.evaluate(`window.cspsSameDocument = true`);

  await page.getByRole('link', { name: 'View Orders' }).click();

  await expect(page).toHaveURL(/\/admin\/orders$/);
  await expect(page.locator('h1')).toHaveText('Orders');
  expect(await page.evaluate(`window.cspsSameDocument === true`), 'the router handled the link').toBe(true);
});

// Testing host smoke (QUAL-05, D-37): the E2E host runs in the Testing environment, so a test can make its own staff
// user and read its own mail. One engine is enough: the routes are API routes, not pages.
import { expect, test } from './fixtures.ts';
import { createStaff, readEmails } from './testing-api.ts';

test('@testing-host a new staff user starts with an empty mailbox', async ({ request }) => {
  const staff = await createStaff(request, 'Admin');

  expect(staff.email).toMatch(/^e2e-[0-9a-f]{32}@csps\.test$/);
  expect(staff.password.length).toBeGreaterThanOrEqual(8);
  expect(await readEmails(request, { to: staff.email })).toEqual([]);
});

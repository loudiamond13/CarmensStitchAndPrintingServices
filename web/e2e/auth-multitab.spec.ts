// Two tabs of one browser share one session (AUTH-05, AUTH-06, T-04-102; plan 04-30), in the three desktop engines.
// Both tabs reload at the same moment and both stay signed in: the refresh is single flight across tabs (Web Locks) and
// the server's grace window tolerates the rest, so no tab is wrongly signed out. Then one tab signs out and the other
// goes to the sign-in page with the session-ended notice, without a reload. A listener on the same BroadcastChannel
// records every message and none of them carries a token or the email.
import { signInAs } from './auth.ts';
import { expect, test } from './fixtures.ts';
import { createStaff } from './testing-api.ts';

/** In every page of the context: record what arrives on the auth channel (a page script; the node program has no DOM). */
const RECORD_CHANNEL = `(() => {
  const channel = new BroadcastChannel('csps-auth');
  window.cspsChannelMessages = [];
  channel.addEventListener('message', (event) => {
    window.cspsChannelMessages.push(JSON.stringify(event.data));
  });
})()`;

test('@auth-multitab two tabs reload together and stay signed in, and a sign-out in one ends the other with no token on the channel', async ({
  page,
  context,
  request,
  guard,
}) => {
  test.setTimeout(120_000);
  // Opening the sign-in page asks the refresh cookie for a session first; with none that answer is a 401.
  guard.expectStatus('/api/v1/auth/refresh', 401);
  const staff = await createStaff(request, 'Manager');
  await context.addInitScript(RECORD_CHANNEL);

  await signInAs(page, request, staff);
  // The guarded devices page boots the real session in each tab from the shared refresh cookie.
  await page.goto('/admin/sessions');
  const second = await context.newPage();
  await second.goto('/admin/sessions');
  const heading = { level: 1, name: 'Signed-in devices' } as const;
  await expect(page.getByRole('heading', heading)).toBeVisible();
  await expect(second.getByRole('heading', heading)).toBeVisible();

  // AUTH-06: both tabs reload at the same moment; both come back signed in.
  await Promise.all([page.reload(), second.reload()]);
  await expect(page.getByRole('heading', heading)).toBeVisible();
  await expect(second.getByRole('heading', heading)).toBeVisible();
  await expect(page).toHaveURL(/\/admin\/sessions$/);
  await expect(second).toHaveURL(/\/admin\/sessions$/);

  // Logout in the first tab sends the second to sign in, with the notice, without a reload.
  await second.evaluate(`window.cspsSameDocument = true`);
  await page.locator('button[aria-haspopup="menu"]').click();
  await page.getByRole('menuitem', { name: 'Logout' }).click();
  await expect(page).toHaveURL(/\/admin\/login/);
  await expect(page.getByText("You've signed out.")).toBeVisible();

  await expect(second.getByRole('heading', { level: 1, name: 'Sign in' })).toBeVisible();
  await expect(second.getByText('Your session ended. Sign in again.')).toBeVisible();
  expect(await second.evaluate(`window.cspsSameDocument === true`), 'the tab was not reloaded').toBe(true);

  // T-04-102: the channel carried the sign-out and no token or email.
  const messages = await second.evaluate<string[]>(`window.cspsChannelMessages`);
  expect(messages.some((message) => message.includes('signed-out'))).toBe(true);
  for (const message of messages) {
    expect(message).not.toContain('eyJ');
    expect(message).not.toContain(staff.email);
    expect(message).not.toMatch(/token/i);
  }
});

// Long-text and dialog-fit backstops for the Phase 5 screens (plan 05-37; UI Considerations "long-text" and "overflow"
// rows), in all five projects. Staff are made with 100-character names (no space to break at) and 256-character emails
// through the Testing staff fixture. At 320 and 390 px:
//   - the roster's person cell, the Email cell, the profile header, the Sign-in Email card, the Edit panel, dialog titles,
//     toasts and the confirm-email page wrap anywhere inside the width;
//   - the sidebar chip and the top bar's user button keep one line and cut the text short, with the full name still the
//     button's text (so the full name is in its accessible name);
//   - four-chip toolbars on the Users and Audit Log screens wrap without sideways scroll;
//   - the slide-overs and dialogs at 320 x 568 (and at 640 x 360, which is 200% zoom of a 1280 x 720 screen) scroll their
//     body inside and keep their footer buttons reachable.
import { randomUUID } from 'node:crypto';
import type { Locator, Page } from '@playwright/test';
import { signInAs } from './auth.ts';
import { expect, expectNoAxeViolations, test } from './fixtures.ts';
import { settle } from './sweep.ts';
import { createStaff, latestEmail, type StaffIdentity } from './testing-api.ts';

/** 100 characters with no space or hyphen to break at: the worst case for a name. */
const LONG_FIRST = `${'Bartholomew'.repeat(9)}x`;
const LONG_LAST = `${'Wolfeschlegel'.repeat(7)}123456789`;
/** 256 characters (the longest accepted address) under the Testing domain, with no break opportunity in the local part. */
const LONG_DOMAIN = '@csps.test';

/** A unique 256-character address: a random tag in front, then filler, then the Testing domain. */
function longEmail(): string {
  const tag = randomUUID().replaceAll('-', '');
  return `${tag}${'a'.repeat(256 - LONG_DOMAIN.length - tag.length)}${LONG_DOMAIN}`;
}

function longIdentity(): Required<StaffIdentity> {
  return { firstName: LONG_FIRST, lastName: LONG_LAST, email: longEmail() };
}

const FULL_NAME = `${LONG_FIRST} ${LONG_LAST}`;

/** True when the page does not scroll sideways (a page script: the node program has no DOM). */
const NO_SIDEWAYS_SCROLL = 'document.documentElement.scrollWidth <= window.innerWidth';

/** The widest elements when the page scrolls sideways, so a failure names them (a page script). */
const READ_OFFENDERS = `(() => {
  const edge = document.documentElement.clientWidth + 0.5;
  const wide = [...document.body.querySelectorAll('*')].filter(
    (element) => element.getClientRects().length > 0 && element.getBoundingClientRect().right > edge,
  );
  const outermost = wide.filter((element) => !wide.some((other) => other !== element && other.contains(element)));
  return outermost.slice(0, 6).map((element) => element.tagName.toLowerCase() + '.' + String(element.className).slice(0, 60) + ' right ' + Math.round(element.getBoundingClientRect().right));
})()`;

/** The page does not scroll sideways; when it does, the failure names the elements that stick out. */
async function expectNoSidewaysScroll(page: Page, what: string): Promise<void> {
  if (!(await page.evaluate<boolean>(NO_SIDEWAYS_SCROLL))) {
    const offenders = await page.evaluate<string[]>(READ_OFFENDERS);
    expect(offenders, `${what}: no sideways scroll`).toEqual([]);
  }
}

interface Fit {
  readonly left: number;
  readonly right: number;
  readonly height: number;
  readonly lineHeight: number;
  readonly scrollWidth: number;
  readonly clientWidth: number;
  readonly innerWidth: number;
  readonly textOverflow: string;
  readonly text: string;
}

// The node program has no DOM types, so the page function is typed by the few members it reads.
interface Measurable {
  getBoundingClientRect(): { readonly left: number; readonly right: number; readonly height: number };
  readonly scrollWidth: number;
  readonly clientWidth: number;
  readonly textContent: string | null;
}

interface PageGlobals {
  readonly innerWidth: number;
  getComputedStyle(element: Measurable): {
    readonly lineHeight: string;
    readonly fontSize: string;
    readonly textOverflow: string;
  };
}

/** Runs in the page (Playwright sends its source), so it uses nothing from this file. */
function measure(element: Measurable): Fit {
  const page = globalThis as unknown as PageGlobals;
  const box = element.getBoundingClientRect();
  const style = page.getComputedStyle(element);
  const lineHeight = Number.parseFloat(style.lineHeight) || Number.parseFloat(style.fontSize) * 1.25;
  return {
    left: box.left,
    right: box.right,
    height: box.height,
    lineHeight,
    scrollWidth: element.scrollWidth,
    clientWidth: element.clientWidth,
    innerWidth: page.innerWidth,
    textOverflow: style.textOverflow,
    text: element.textContent ?? '',
  };
}

async function fit(locator: Locator): Promise<Fit> {
  return locator.evaluate(measure);
}

/** The text is inside the width, none of it clipped, and long enough to need more than one line. */
async function expectWraps(locator: Locator, what: string): Promise<void> {
  await expect(locator, `${what} shows`).toBeVisible();
  const reading = await fit(locator);
  expect(reading.left, `${what}: left edge`).toBeGreaterThanOrEqual(-0.5);
  expect(reading.right, `${what}: right edge`).toBeLessThanOrEqual(reading.innerWidth + 0.5);
  if (reading.clientWidth > 0) {
    expect(reading.scrollWidth, `${what}: nothing cut off inside`).toBeLessThanOrEqual(reading.clientWidth + 1);
  }
  expect(reading.height / reading.lineHeight, `${what}: wrapped onto several lines`).toBeGreaterThan(1.5);
}

/** The text keeps one line, is cut short with an ellipsis inside the width, and the element still holds the whole text. */
async function expectTruncates(locator: Locator, what: string, wholeText: string): Promise<void> {
  await expect(locator, `${what} shows`).toBeVisible();
  const reading = await fit(locator);
  expect(reading.text, `${what}: the full text is kept for assistive technology`).toContain(wholeText);
  expect(reading.left, `${what}: left edge`).toBeGreaterThanOrEqual(-0.5);
  expect(reading.right, `${what}: right edge`).toBeLessThanOrEqual(reading.innerWidth + 0.5);
  expect(reading.height / reading.lineHeight, `${what}: one line`).toBeLessThan(1.5);
  expect(reading.textOverflow, `${what}: ellipsis`).toBe('ellipsis');
  expect(reading.scrollWidth, `${what}: the text is cut short`).toBeGreaterThan(reading.clientWidth);
}

/** A dialog or panel is inside the width and its footer buttons are on screen. */
async function expectDialogFits(page: Page, dialog: Locator, buttons: readonly string[], what: string): Promise<void> {
  await expect(dialog, `${what} shows`).toBeVisible();
  // The panel slides in and the dialog fades in: measure once the entrance has finished.
  await settle(page);
  expect(await page.evaluate(NO_SIDEWAYS_SCROLL), `${what}: no sideways scroll`).toBe(true);
  const reading = await fit(dialog);
  expect(reading.left, `${what}: left edge`).toBeGreaterThanOrEqual(-0.5);
  expect(reading.right, `${what}: right edge`).toBeLessThanOrEqual(reading.innerWidth + 0.5);
  expect(reading.scrollWidth, `${what}: nothing scrolls sideways inside`).toBeLessThanOrEqual(reading.clientWidth + 1);
  for (const name of buttons) {
    await expect(dialog.getByRole('button', { name, exact: true }), `${what}: ${name} reachable`).toBeInViewport();
  }
}

const PHONES = [
  { width: 320, height: 568 },
  { width: 390, height: 844 },
] as const;

/** The roster's body rows (the phone layout stacks them as cards but keeps the same elements). */
function rows(page: Page) {
  return page.locator('tbody tr');
}

/** Finds one person on the roster by the unique email they were made with. */
async function findPerson(page: Page, email: string): Promise<Locator> {
  await page.goto('/admin/users');
  await expect(page.getByRole('heading', { level: 1, name: 'Users' })).toBeVisible();
  // Search takes 100 characters at most; the random tag at the front of every address is unique.
  const search = email.slice(0, 60);
  await page.getByPlaceholder('Name or email').fill(search);
  await expect.poll(() => new URL(page.url()).searchParams.get('q')).toBe(search);
  await expect(rows(page)).toHaveCount(1);
  return rows(page).first();
}

/** Presses a button from the keyboard: Safari does not focus a button on click, and the focus return is part of what is proved. */
async function press(page: Page, button: Locator): Promise<void> {
  await button.focus();
  await page.keyboard.press('Enter');
}

test('@long-text the profile header, the sidebar chip and the top bar cope with a 100-character name and a 256-character email', async ({
  page,
  request,
  guard,
}) => {
  test.setTimeout(150_000);
  guard.expectStatus('/api/v1/auth/refresh', 401);
  const identity = longIdentity();
  const manager = await createStaff(request, 'Manager', undefined, identity);
  await signInAs(page, request, manager);

  // The header and the Sign-in Email card wrap anywhere on a phone.
  for (const { width, height } of PHONES) {
    await page.setViewportSize({ width, height });
    await page.goto('/admin/profile');
    await expect(page.getByRole('heading', { level: 1, name: FULL_NAME })).toBeVisible();
    await expectWraps(page.getByRole('heading', { level: 1, name: FULL_NAME }), `${String(width)}px: profile name`);
    await expectWraps(page.getByText(`${identity.email} · Member since `), `${String(width)}px: header email line`);
    await expectWraps(
      page.getByRole('region', { name: 'Sign-in Email' }).getByText(identity.email),
      `${String(width)}px: Sign-in Email card`,
    );
    expect(await page.evaluate(NO_SIDEWAYS_SCROLL), `${String(width)}px: no sideways scroll`).toBe(true);
    await expectNoAxeViolations(page);
  }

  // The top bar's user button shows the name from 768 px up, and the sidebar chip from 1024 px up (a rail below that): each
  // keeps one line and is cut short, with the whole name still its text.
  await page.setViewportSize({ width: 1024, height: 768 });
  await page.goto('/admin/profile');
  await expectTruncates(
    page.locator('button[aria-haspopup="menu"] strong').first(),
    'top bar user name at 1024px',
    FULL_NAME,
  );
  await expectTruncates(
    page.locator('[data-ui="s-admin-side"] aside strong').filter({ hasText: FULL_NAME }),
    'sidebar chip name',
    FULL_NAME,
  );
  expect(await page.evaluate(NO_SIDEWAYS_SCROLL)).toBe(true);
});

test('@long-text the roster, the Edit panel, the dialogs and the toast wrap a long-named person', async ({
  page,
  request,
  guard,
}) => {
  test.setTimeout(240_000);
  guard.expectStatus('/api/v1/auth/refresh', 401);
  const identity = longIdentity();
  const person = await createStaff(request, 'Admin', undefined, identity);
  await signInAs(page, request, await createStaff(request, 'Manager'));

  // The person cell and the Email cell wrap on a phone, and the row's actions stay reachable.
  for (const { width, height } of PHONES) {
    await page.setViewportSize({ width, height });
    const row = await findPerson(page, person.email);
    await expectWraps(row.locator('td[data-label="User"] strong'), `${String(width)}px: person cell name`);
    await expectWraps(row.locator('td[data-label="Email"]'), `${String(width)}px: Email cell`);
    expect(await page.evaluate(NO_SIDEWAYS_SCROLL), `${String(width)}px: no sideways scroll`).toBe(true);
    await row.getByRole('button', { name: /^Delete / }).scrollIntoViewIfNeeded();
    await expect(row.getByRole('button', { name: /^Delete / })).toBeInViewport();
    await expectNoAxeViolations(page);
  }

  // The Edit panel at 320 x 568: the long values sit in their fields, the body scrolls inside, the footer stays reachable.
  await page.setViewportSize({ width: 320, height: 568 });
  const row = await findPerson(page, person.email);
  await press(page, row.getByRole('button', { name: /^Edit / }));
  const panel = page.getByRole('dialog', { name: 'Edit User' });
  await expect(panel).toBeVisible();
  await expect(panel.getByRole('textbox', { name: /^First name/ })).toHaveValue(LONG_FIRST);
  await expect(panel.getByRole('textbox', { name: /^Email/ })).toHaveValue(person.email);
  await expectDialogFits(page, panel, ['Save Changes'], 'Edit User at 320x568');
  await expectNoAxeViolations(page);

  // The Lock and Set a temporary password dialogs stack over the panel; their titles wrap and their buttons stay reachable.
  await panel.getByRole('heading', { level: 3, name: 'Account access' }).scrollIntoViewIfNeeded();
  const lock = page.getByRole('dialog', { name: `Lock ${FULL_NAME}?` });
  await press(page, panel.getByRole('button', { name: 'Lock', exact: true }));
  await expectDialogFits(page, lock, ['Keep Unlocked', 'Lock User'], 'Lock dialog at 320x568');
  await expectWraps(lock.getByRole('heading', { name: `Lock ${FULL_NAME}?` }), 'Lock dialog title');
  await lock.getByRole('button', { name: 'Keep Unlocked' }).click();
  await expect(lock).toBeHidden();

  const temporary = page.getByRole('dialog', { name: 'Set a temporary password' });
  await press(page, panel.getByRole('button', { name: 'Set Temporary Password' }));
  await expectDialogFits(page, temporary, ['Cancel', 'Set Password'], 'Set a temporary password at 320x568');
  await expectWraps(temporary.getByText(`For ${FULL_NAME}`), 'Set a temporary password: the name line');
  await temporary.getByRole('button', { name: 'Cancel' }).click();
  await expect(temporary).toBeHidden();
  await panel.getByRole('button', { name: 'Cancel', exact: true }).click();
  await expect(panel).toBeHidden();

  // The Deactivate and Delete dialogs from the row; deactivating raises a toast that names the person.
  const deactivate = page.getByRole('dialog', { name: `Deactivate ${FULL_NAME}?` });
  await press(page, row.getByRole('button', { name: /^Deactivate / }));
  await expectDialogFits(page, deactivate, ['Keep Active', 'Deactivate User'], 'Deactivate dialog at 320x568');
  await expectWraps(deactivate.getByRole('heading', { name: `Deactivate ${FULL_NAME}?` }), 'Deactivate dialog title');
  await deactivate.getByRole('button', { name: 'Keep Active' }).click();
  await expect(deactivate).toBeHidden();

  const remove = page.getByRole('dialog', { name: `Delete ${FULL_NAME}?` });
  await press(page, row.getByRole('button', { name: /^Delete / }));
  await expectDialogFits(page, remove, ['Cancel', 'Delete User'], 'Delete dialog at 320x568');
  await expectWraps(remove.getByRole('heading', { name: `Delete ${FULL_NAME}?` }), 'Delete dialog title');
  await remove.getByRole('button', { name: 'Cancel' }).click();
  await expect(remove).toBeHidden();

  await press(page, row.getByRole('button', { name: /^Deactivate / }));
  await deactivate.getByRole('button', { name: 'Deactivate User' }).click();
  await expectWraps(page.getByText(`${FULL_NAME} can no longer sign in.`), 'the Deactivate toast message');
  expect(await page.evaluate(NO_SIDEWAYS_SCROLL)).toBe(true);
});

test('@long-text the slide-overs and dialogs keep their footers reachable at 200% zoom (640 x 360)', async ({
  page,
  request,
  guard,
}) => {
  test.setTimeout(150_000);
  guard.expectStatus('/api/v1/auth/refresh', 401);
  const person = await createStaff(request, 'Admin', undefined, longIdentity());
  await signInAs(page, request, await createStaff(request, 'Manager'));
  await page.setViewportSize({ width: 640, height: 360 });

  const row = await findPerson(page, person.email);
  await press(page, row.getByRole('button', { name: /^Edit / }));
  const panel = page.getByRole('dialog', { name: 'Edit User' });
  await expectDialogFits(page, panel, ['Save Changes'], 'Edit User at 640x360');
  await panel.getByRole('button', { name: 'Cancel', exact: true }).click();
  await expect(panel).toBeHidden();

  await press(page, page.getByRole('button', { name: 'Add User' }));
  const add = page.getByRole('dialog', { name: 'Add User' });
  await expectDialogFits(page, add, ['Create User'], 'Add User at 640x360');
  await add.getByRole('button', { name: 'Cancel', exact: true }).click();
  await expect(add).toBeHidden();

  const deactivate = page.getByRole('dialog', { name: `Deactivate ${FULL_NAME}?` });
  await press(page, row.getByRole('button', { name: /^Deactivate / }));
  await expectDialogFits(page, deactivate, ['Keep Active', 'Deactivate User'], 'Deactivate dialog at 640x360');
  await deactivate.getByRole('button', { name: 'Keep Active' }).click();
  await expect(deactivate).toBeHidden();
});

test('@long-text the Add User panel and the Change Email dialog fit 320 x 568 with long values typed in', async ({
  page,
  request,
  guard,
}) => {
  test.setTimeout(150_000);
  guard.expectStatus('/api/v1/auth/refresh', 401);
  const manager = await createStaff(request, 'Manager');
  await signInAs(page, request, manager);
  await page.setViewportSize({ width: 320, height: 568 });

  await page.goto('/admin/users');
  await expect(page.getByRole('heading', { level: 1, name: 'Users' })).toBeVisible();
  await press(page, page.getByRole('button', { name: 'Add User' }));
  const add = page.getByRole('dialog', { name: 'Add User' });
  await expect(add).toBeVisible();
  await add.getByRole('textbox', { name: /^First name/ }).fill(LONG_FIRST);
  await add.getByRole('textbox', { name: /^Last name/ }).fill(LONG_LAST);
  await add.getByRole('textbox', { name: /^Email/ }).fill(longEmail());
  await expectDialogFits(page, add, ['Create User'], 'Add User with long values at 320x568');
  await expectNoAxeViolations(page);
  await add.getByRole('button', { name: 'Cancel', exact: true }).click();
  await expect(add).toBeHidden();

  await page.goto('/admin/profile');
  await page.getByRole('region', { name: 'Sign-in Email' }).getByRole('button', { name: 'Change Email' }).click();
  const change = page.getByRole('dialog', { name: 'Change your email' });
  await change.getByRole('textbox', { name: 'New email' }).fill(longEmail());
  await change.getByLabel('Current password').fill(manager.password);
  await expectDialogFits(page, change, ['Send Confirmation Link'], 'Change Email with a long address at 320x568');
  await expectNoAxeViolations(page);
});

test('@long-text a pending change to a 256-character address wraps on My Profile and on the confirm-email page', async ({
  page,
  request,
  guard,
}) => {
  test.setTimeout(180_000);
  guard.expectStatus('/api/v1/auth/refresh', 401);
  const manager = await createStaff(request, 'Manager');
  await signInAs(page, request, manager);
  const newEmail = longEmail();
  await page.setViewportSize({ width: 320, height: 568 });

  await page.goto('/admin/profile');
  const card = page.getByRole('region', { name: 'Sign-in Email' });
  await card.getByRole('button', { name: 'Change Email' }).click();
  const dialog = page.getByRole('dialog', { name: 'Change your email' });
  await dialog.getByRole('textbox', { name: 'New email' }).fill(newEmail);
  await dialog.getByLabel('Current password').fill(manager.password);
  await dialog.getByRole('button', { name: 'Send Confirmation Link' }).click();
  await expect(dialog).toBeHidden();

  // The note under the card and the toast name the long address inside the width.
  await expectWraps(card.getByText(`Waiting for confirmation at ${newEmail}.`, { exact: false }), 'the pending note');
  expect(await page.evaluate(NO_SIDEWAYS_SCROLL)).toBe(true);
  await expectNoAxeViolations(page);

  const mail = await latestEmail(request, newEmail, { subject: 'Confirm your new CSPS email' });
  const link = /https?:\/\/[^\s"'<>]+#token=[^\s"'<>]+/.exec(mail.text)?.[0];
  if (link === undefined) {
    throw new Error('The email carries no link with a token.');
  }
  for (const { width, height } of PHONES) {
    await page.setViewportSize({ width, height });
    await page.goto(link);
    await expect(page.getByRole('button', { name: 'Confirm New Email' })).toBeVisible();
    await expectWraps(page.getByText(newEmail, { exact: false }).first(), `${String(width)}px: confirm-email address`);
    expect(await page.evaluate(NO_SIDEWAYS_SCROLL), `${String(width)}px: no sideways scroll`).toBe(true);
    await expectNoAxeViolations(page);
  }
});

test('@long-text four-chip toolbars wrap on Users and on the Audit Log at 320 px, and a long search wraps in its chip', async ({
  page,
  request,
  guard,
}) => {
  test.setTimeout(150_000);
  guard.expectStatus('/api/v1/auth/refresh', 401);
  const person = await createStaff(request, 'Admin', undefined, longIdentity());
  await signInAs(page, request, await createStaff(request, 'Manager'));
  await page.setViewportSize({ width: 320, height: 800 });

  // Users has three filters (Search, Role, Status): all three chips, the search one long.
  const longSearch = 'q'.repeat(100);
  await page.goto(`/admin/users?q=${longSearch}&role=admin&status=active`);
  await expect(page.getByRole('heading', { level: 1, name: 'Users' })).toBeVisible();
  await expect(page.getByText('Role: Admin')).toBeVisible();
  await expect(page.getByText('Status: Active')).toBeVisible();
  await expectTruncates(page.getByText(`Search: ${longSearch}`), 'Users: the long Search chip', longSearch);
  await expectNoSidewaysScroll(page, 'Users');
  await expectNoAxeViolations(page);

  // The Audit Log has four chips (Range, Done by, Action, Done to): the two people are the long-named one.
  const id = person.userId.toLowerCase();
  await page.goto(`/admin/audit-log?range=all&actor=${id}&target=${id}&action=user.details-changed`);
  await expect(page.getByRole('heading', { level: 1, name: 'Audit Log' })).toBeVisible();
  await expect(page.getByText('Action: User details changed')).toBeVisible();
  await expectTruncates(page.getByText(`Done by: ${FULL_NAME}`), 'Audit Log: the Done by chip', FULL_NAME);
  await expectTruncates(page.getByText(`Done to: ${FULL_NAME}`), 'Audit Log: the Done to chip', FULL_NAME);
  await expectNoSidewaysScroll(page, 'Audit Log');
  await expectNoAxeViolations(page);
});

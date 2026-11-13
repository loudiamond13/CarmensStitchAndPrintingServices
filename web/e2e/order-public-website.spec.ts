// The Public website card and window of an order end to end (GAL-03, CONT-03, D-09 to D-16, D-38; plan 11-27), in all five projects.
// Staff tick the customer's OK, show an order from its page and take it off again. Every test makes its own staff user and its own
// order (with a photo, drawn in the page) through the Testing routes, runs under the shared guard (console, page errors, CSP, failed
// responses), and checks the public gallery under the site content lock, because the gallery is one set for all projects.
import type { APIRequestContext, Page } from '@playwright/test';
import { randomUUID } from 'node:crypto';
import { signInAs } from './auth.ts';
import { expect, expectNoAxeViolations, test } from './fixtures.ts';
import { manilaDate, NO_SIDEWAYS_SCROLL, press } from './helpers.ts';
import { deleteOrderThroughApi, drawJpegs, openOrder, seedOrder, tiles, uploadAndWait } from './photos.ts';
import { withSiteContentLock } from './site-content-lock.ts';
import { createStaff, type StaffRole } from './testing-api.ts';

interface SeededOrder {
  readonly id: string;
  readonly number: string;
  readonly team: string;
}

/** Makes a staff user and an order with one photo, and opens the order as that user. */
async function openOrderWithPhoto(
  page: Page,
  request: APIRequestContext,
  role: StaffRole,
  label: string,
): Promise<SeededOrder> {
  const staff = await createStaff(request, role);
  const { id, number } = await seedOrder(request, {
    prefix: 'ORD-2086',
    label,
    itemDescription: 'E2E public website jersey',
  });
  await openOrder(page, request, staff, id, number);
  await uploadAndWait(page, number, await drawJpegs(page, 1), 1);
  return { id, number, team: `E2E ${label} Team` };
}

/** The Public website card of the order page. */
function card(page: Page) {
  return page.getByRole('region', { name: 'Public website' });
}

/** The teams the public gallery lists now. */
async function publicGalleryTeams(request: APIRequestContext): Promise<string[]> {
  const response = await request.get('/api/v1/public/gallery');
  expect(response.status(), 'GET /api/v1/public/gallery').toBe(200);
  const body = (await response.json()) as { items: { team: string }[] };
  return body.items.map((item) => item.team);
}

/**
 * Opens the window, ticks the OK and Show, chooses a line when the items gave none, and saves. Showing an order puts it at the top of the
 * gallery, which is one set for all projects, so a test calls this under the site content lock and deletes the order before it lets go.
 */
async function showFromWindow(page: Page): Promise<void> {
  await press(page, card(page).getByRole('button', { name: 'Edit public website settings' }));
  const dialog = page.getByRole('dialog', { name: 'Public Website' });
  await expect(dialog).toBeVisible();
  await dialog.getByRole('checkbox', { name: 'Customer said OK to show' }).check();
  await dialog.getByRole('checkbox', { name: 'Show on the website' }).check();
  const line = dialog.getByRole('combobox', { name: /^Show under/ });
  if ((await line.inputValue()) === '') {
    await line.selectOption({ index: 1 });
  }
  await dialog.getByRole('button', { name: 'Save Changes' }).click();
  await expect(dialog).toBeHidden();
}

test('@order-public-website an Admin ticks the customer OK, shows an order from its page, and the public gallery lists it', async ({
  page,
  request,
  guard,
}) => {
  test.setTimeout(240_000);
  guard.expectStatus('/api/v1/auth/refresh', 401);
  const order = await openOrderWithPhoto(page, request, 'Admin', 'Public Website');
  const region = card(page);
  await expect(region).toBeVisible();
  await expect(region).toContainText('Customer OK');
  await expect(region).toContainText('No');
  await expect(region).toContainText('Not shown');
  await expectNoAxeViolations(page);

  await press(page, region.getByRole('button', { name: 'Edit public website settings' }));
  const dialog = page.getByRole('dialog', { name: 'Public Website' });
  await expect(dialog).toBeVisible();
  await expect(dialog).toContainText(`${order.number} · ${order.team}`);
  const show = dialog.getByRole('checkbox', { name: 'Show on the website' });
  await expect(show).toHaveAttribute('aria-disabled', 'true');
  await expect(dialog.getByText('Tick Customer said OK to show first.')).toBeVisible();
  expect(await page.evaluate(NO_SIDEWAYS_SCROLL)).toBe(true);
  await expectNoAxeViolations(page);
  await dialog.getByRole('button', { name: 'Cancel' }).click();
  await expect(dialog).toBeHidden();
  await expect(region.getByRole('button', { name: 'Edit public website settings' })).toBeFocused();

  // The gallery is one set for all projects: the order is shown, read and deleted again under the lock.
  await withSiteContentLock(async () => {
    try {
      await showFromWindow(page);
      await expect(page.getByText('Order shown on the website')).toBeVisible();
      await expect(region.getByRole('button', { name: 'Edit public website settings' })).toBeFocused();
      await expect(region).toContainText(/Yes, recorded .+ by .+/);
      await expect(region.getByText('Shown', { exact: true })).toBeVisible();
      await expect(region).toContainText(order.team);
      await expectNoAxeViolations(page);

      expect(await publicGalleryTeams(request)).toContain(order.team);
    } finally {
      await deleteOrderThroughApi(page, order.id);
    }
  });
});

/** The value cell beside a row label of the card. */
function valueOf(page: Page, label: string) {
  return card(page).locator('dt', { hasText: label }).locator('xpath=following-sibling::dd');
}

/** Opens the window, unticks the customer's OK (which unticks Show too) and saves. */
async function takeOffFromWindow(page: Page): Promise<void> {
  await press(page, card(page).getByRole('button', { name: 'Edit public website settings' }));
  const dialog = page.getByRole('dialog', { name: 'Public Website' });
  await expect(dialog).toBeVisible();
  await dialog.getByRole('checkbox', { name: 'Customer said OK to show' }).uncheck();
  await expect(dialog.getByRole('checkbox', { name: 'Show on the website' })).not.toBeChecked();
  await dialog.getByRole('button', { name: 'Save Changes' }).click();
  await expect(dialog).toBeHidden();
}

test('@order-public-website a Manager takes a shown order off the website: the gallery drops it and its photo stays on the order', async ({
  page,
  request,
  guard,
}) => {
  test.setTimeout(240_000);
  guard.expectStatus('/api/v1/auth/refresh', 401);
  const order = await openOrderWithPhoto(page, request, 'Manager', 'Take Off');
  await withSiteContentLock(async () => {
    try {
      await showFromWindow(page);
      await expect(page.getByText('Order shown on the website')).toBeVisible();
      await expect(valueOf(page, 'On the website')).toContainText('Shown');

      await takeOffFromWindow(page);
      await expect(page.getByText('Order taken off the website')).toBeVisible();
      await expect(page.getByText('Its photos stay on the order.')).toBeVisible();
      await expect(valueOf(page, 'Customer OK')).toHaveText('No');
      await expect(valueOf(page, 'On the website')).toContainText('Not shown');
      await expect(tiles(page)).toHaveCount(1);

      // The public gallery no longer lists the order on its next read.
      expect(await publicGalleryTeams(request)).not.toContain(order.team);
    } finally {
      await deleteOrderThroughApi(page, order.id);
    }
  });
});

test('@order-public-website a Cancelled order says it cannot be shown and offers no Edit, and a Completed order can still be edited', async ({
  page,
  request,
  guard,
}) => {
  test.setTimeout(240_000);
  guard.expectStatus('/api/v1/auth/refresh', 401);
  const manager = await createStaff(request, 'Manager');
  const cancelled = await seedOrder(
    request,
    { prefix: 'ORD-2085', label: 'Public Cancelled', itemDescription: 'E2E cancelled jersey', status: 'cancelled' },
    manager.userId,
  );
  await openOrder(page, request, manager, cancelled.id, cancelled.number);
  await expect(card(page)).toContainText("Cancelled orders can't be shown on the website.");
  await expect(valueOf(page, 'On the website')).toContainText('Not shown');
  await expect(card(page).getByRole('button', { name: 'Edit public website settings' })).toHaveCount(0);
  await expectNoAxeViolations(page);

  // 6 x 700 = 4,200.00 paid in full, so the order can be Completed, which locks every other card and not this one.
  const completed = await seedOrder(
    request,
    {
      prefix: 'ORD-2084',
      label: 'Public Completed',
      itemDescription: 'E2E completed jersey',
      status: 'completed',
      payment: { amount: 4200 },
    },
    manager.userId,
  );
  await page.goto(`/admin/orders/${completed.id}`);
  await expect(page.getByRole('heading', { level: 1, name: completed.number })).toBeVisible();
  await press(page, card(page).getByRole('button', { name: 'Edit public website settings' }));
  const dialog = page.getByRole('dialog', { name: 'Public Website' });
  await expect(dialog).toBeVisible();
  await dialog.getByRole('checkbox', { name: 'Customer said OK to show' }).check();
  await dialog.getByRole('button', { name: 'Save Changes' }).click();
  await expect(dialog).toBeHidden();
  await expect(page.getByText('Public website settings saved')).toBeVisible();
  await expect(valueOf(page, 'Customer OK')).toContainText(/^Yes, recorded /);
});

test('@order-public-website at 320px the window is a bottom sheet with a footer that fits, the page does not scroll sideways and focus returns to Edit', async ({
  page,
  request,
  guard,
}) => {
  test.setTimeout(240_000);
  guard.expectStatus('/api/v1/auth/refresh', 401);
  const manager = await createStaff(request, 'Manager');
  const { id, number } = await seedOrder(
    request,
    { prefix: 'ORD-2083', label: 'Public Narrow', itemDescription: 'E2E narrow jersey' },
    manager.userId,
  );
  await page.setViewportSize({ width: 320, height: 640 });
  await openOrder(page, request, manager, id, number);
  expect(await page.evaluate(NO_SIDEWAYS_SCROLL)).toBe(true);

  const edit = card(page).getByRole('button', { name: 'Edit public website settings' });
  await press(page, edit);
  const dialog = page.getByRole('dialog', { name: 'Public Website' });
  await expect(dialog).toBeVisible();
  // A bottom sheet: it spans the width of the screen and rests on its bottom edge (UI-SPEC: 639px and below).
  const box = await dialog.boundingBox();
  expect(box, 'the window has a box').not.toBeNull();
  expect(Math.round(box?.width ?? 0)).toBe(320);
  expect(Math.round((box?.y ?? 0) + (box?.height ?? 0))).toBe(640);
  // The footer fits: both buttons sit inside the sheet.
  for (const name of ['Cancel', 'Save Changes']) {
    const button = await dialog.getByRole('button', { name }).boundingBox();
    expect(button, `${name} has a box`).not.toBeNull();
    expect((button?.x ?? 0) + (button?.width ?? 0)).toBeLessThanOrEqual(320);
    expect(button?.x ?? -1).toBeGreaterThanOrEqual(0);
  }
  expect(await page.evaluate(NO_SIDEWAYS_SCROLL)).toBe(true);
  await expectNoAxeViolations(page);

  await dialog.getByRole('button', { name: 'Cancel' }).click();
  await expect(dialog).toBeHidden();
  await expect(edit).toBeFocused();
  expect(await page.evaluate(NO_SIDEWAYS_SCROLL)).toBe(true);
});

test('@order-public-website at 820px the card joins the side grid after Customer, as wide as the grid', async ({
  page,
  request,
  guard,
}) => {
  test.setTimeout(240_000);
  guard.expectStatus('/api/v1/auth/refresh', 401);
  const manager = await createStaff(request, 'Manager');
  const { id, number } = await seedOrder(
    request,
    { prefix: 'ORD-2082', label: 'Public Tablet', itemDescription: 'E2E tablet jersey' },
    manager.userId,
  );
  await page.setViewportSize({ width: 820, height: 1100 });
  await openOrder(page, request, manager, id, number);

  const customer = await page.getByRole('region', { name: 'Customer' }).boundingBox();
  const publicCard = await card(page).boundingBox();
  const history = await page.getByRole('region', { name: 'Status history' }).boundingBox();
  expect(customer && publicCard && history, 'the three cards have boxes').toBeTruthy();
  // After Customer, before Status history, and across both columns of the side grid.
  expect(publicCard?.y ?? 0).toBeGreaterThanOrEqual((customer?.y ?? 0) + (customer?.height ?? 0) - 1);
  expect(history?.y ?? 0).toBeGreaterThanOrEqual((publicCard?.y ?? 0) + (publicCard?.height ?? 0) - 1);
  expect(Math.round(publicCard?.width ?? 0)).toBe(Math.round(history?.width ?? -1));
  expect(await page.evaluate(NO_SIDEWAYS_SCROLL)).toBe(true);
  await expectNoAxeViolations(page);
});

// The Public website card on the New Order and Edit Order forms (UI-SPEC F1 and F2; D-11, D-16; plan 11-35).

/** The Public website card of an order form. */
function formCard(page: Page) {
  return page.getByRole('region', { name: 'Public website' });
}

/** Fills the New Order form with one basketball item, the minimum a save needs. */
async function fillNewOrder(page: Page, customer: string, team: string): Promise<void> {
  await page.getByLabel(/^Customer name/).fill(customer);
  await page.getByLabel(/^Team \/ organization/).fill(team);
  await page.getByLabel(/^Contact number/).fill('0917 000 0000');
  await page.getByLabel(/^Due date/).fill(manilaDate(5));
  await page.getByLabel(/^Product type/).selectOption({ label: 'Basketball Jersey' });
  await page.getByLabel(/^Description/).fill('E2E form public jersey');
  await page.getByLabel(/^Qty/).fill('12');
  await page.getByLabel(/^Unit price/).fill('780');
}

test('@order-form-public an Admin creates an order with the customer OK and Show ticked on the form, and its page shows it on the website', async ({
  page,
  request,
  guard,
}) => {
  test.setTimeout(240_000);
  guard.expectStatus('/api/v1/auth/refresh', 401);
  const admin = await createStaff(request, 'Admin');
  const customer = `E2E Form Public ${randomUUID().replaceAll('-', '').slice(0, 8)}`;
  await signInAs(page, request, admin);

  await page.goto('/admin/orders/new');
  await expect(page.getByRole('heading', { level: 1, name: 'New Order' })).toBeVisible();
  const region = formCard(page);
  await expect(region).toBeVisible();
  await expect(region.getByText("Only with the customer's OK.")).toBeVisible();
  await expect(region.getByRole('checkbox', { name: 'Customer said OK to show' })).not.toBeChecked();
  await expect(region.getByRole('checkbox', { name: 'Show on the website' })).not.toBeChecked();
  await expect(region.getByRole('checkbox', { name: 'Show on the website' })).toHaveAttribute('aria-disabled', 'true');
  await expectNoAxeViolations(page);

  await fillNewOrder(page, customer, 'E2E Form Public Team');
  await region.getByRole('checkbox', { name: 'Customer said OK to show' }).check();
  await region.getByRole('checkbox', { name: 'Show on the website' }).check();
  await region.getByRole('combobox', { name: /^Show under/ }).selectOption({ index: 1 });
  await expectNoAxeViolations(page);
  // The saved order is shown at the top of the gallery, which is one set for all projects: it is saved, read and deleted under the lock.
  await withSiteContentLock(async () => {
    await page.getByRole('button', { name: 'Save Order' }).click();
    await expect(page).toHaveURL(/\/admin\/orders\/[0-9a-f-]{36}$/);
    const id = /\/admin\/orders\/([0-9a-f-]{36})$/.exec(page.url())?.[1] ?? '';
    try {
      const saved = formCard(page);
      await expect(saved).toBeVisible();
      await expect(saved).toContainText(/Yes, recorded .+ by .+/);
      await expect(saved.getByText('Shown', { exact: true })).toBeVisible();
      await expect(saved).toContainText('E2E Form Public Team');
    } finally {
      await deleteOrderThroughApi(page, id);
    }
  });
});

test('@order-form-public a Manager edits a shown order, changes Name shown, saves, and the public gallery shows the new name', async ({
  page,
  request,
  guard,
}) => {
  test.setTimeout(240_000);
  guard.expectStatus('/api/v1/auth/refresh', 401);
  const order = await openOrderWithPhoto(page, request, 'Manager', 'Form Edit');
  await withSiteContentLock(async () => {
    try {
      await editShownOrder(page, request, order);
    } finally {
      await deleteOrderThroughApi(page, order.id);
    }
  });
});

/** Shows the order, renames it on the edit form and reads the new name on the order page and in the public gallery (under the lock). */
async function editShownOrder(page: Page, request: APIRequestContext, order: SeededOrder): Promise<void> {
  await showFromWindow(page);
  await expect(page.getByText('Order shown on the website')).toBeVisible();

  await page.getByRole('link', { name: 'Edit Details' }).first().click();
  await expect(page).toHaveURL(new RegExp(`/admin/orders/${order.id}/edit$`));
  const region = formCard(page);
  await expect(region).toBeVisible();
  await expect(region.getByRole('checkbox', { name: 'Customer said OK to show' })).toBeChecked();
  await expect(region.getByRole('checkbox', { name: 'Show on the website' })).toBeChecked();
  await expect(region.getByRole('textbox', { name: /^Name shown/ })).toHaveValue('');
  await expectNoAxeViolations(page);

  // A seeded order has no contact number, which an edit needs.
  await page.getByLabel(/^Contact number/).fill('0917 555 0102');
  const shownName = `E2E Renamed ${randomUUID().replaceAll('-', '').slice(0, 8)}`;
  await region.getByRole('textbox', { name: /^Name shown/ }).fill(shownName);
  await page.getByRole('button', { name: 'Save Changes' }).click();

  await expect(page).toHaveURL(new RegExp(`/admin/orders/${order.id}$`));
  await expect(page.getByText('Order details saved')).toBeVisible();
  await expect(valueOf(page, 'Name shown')).toContainText(shownName);
  await expect(valueOf(page, 'On the website')).toContainText('Shown');

  expect(await publicGalleryTeams(request)).toContain(shownName);
}

/** Every label, box and line of the card sits inside the screen, and the page has no sideways scroll. */
async function expectCardInsideScreen(page: Page, width: number): Promise<void> {
  const region = formCard(page);
  await expect(region).toBeVisible();
  await region.scrollIntoViewIfNeeded();
  const parts = region.locator('label, input, select, p');
  const count = await parts.count();
  expect(count, 'the card has parts to measure').toBeGreaterThan(4);
  for (let index = 0; index < count; index += 1) {
    const box = await parts.nth(index).boundingBox();
    if (box !== null) {
      expect(box.x + box.width, `part ${String(index)} of the card ends inside the screen`).toBeLessThanOrEqual(
        width + 0.5,
      );
    }
  }
  expect(await page.evaluate(NO_SIDEWAYS_SCROLL)).toBe(true);
}

test('@order-form-public at 320px the card stacks on the New Order and Edit Order forms with no sideways scroll', async ({
  page,
  request,
  guard,
}) => {
  test.setTimeout(240_000);
  guard.expectStatus('/api/v1/auth/refresh', 401);
  const manager = await createStaff(request, 'Manager');
  const { id, number } = await seedOrder(
    request,
    { prefix: 'ORD-2081', label: 'Form Narrow', itemDescription: 'E2E form narrow jersey' },
    manager.userId,
  );
  await page.setViewportSize({ width: 320, height: 640 });
  await openOrder(page, request, manager, id, number);

  await page.goto(`/admin/orders/${id}/edit`);
  await expect(page.getByRole('heading', { level: 1, name: 'Edit Order' })).toBeVisible();
  await expectCardInsideScreen(page, 320);
  await expectNoAxeViolations(page);

  // The New Order form comes last: it is left changed, so nothing navigates away from it.
  await page.goto('/admin/orders/new');
  await expect(page.getByRole('heading', { level: 1, name: 'New Order' })).toBeVisible();
  await page.getByRole('checkbox', { name: 'Customer said OK to show' }).check();
  await page.getByLabel(/^Name shown/).fill('E2E A Very Long Name Shown On The Website To Test Wrapping');
  await expectCardInsideScreen(page, 320);
  await expectNoAxeViolations(page);
});

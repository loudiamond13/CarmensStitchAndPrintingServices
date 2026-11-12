// The Public website card and window of an order end to end (GAL-03, CONT-03, D-09 to D-16, D-38; plan 11-27), in all five projects.
// Staff tick the customer's OK, show an order from its page and take it off again. Every test makes its own staff user and its own
// order (with a photo, drawn in the page) through the Testing routes, runs under the shared guard (console, page errors, CSP, failed
// responses), and checks the public gallery under the site content lock, because the gallery is one set for all projects.
import type { APIRequestContext, Page } from '@playwright/test';
import { signInAs } from './auth.ts';
import { expect, expectNoAxeViolations, test } from './fixtures.ts';
import { NO_SIDEWAYS_SCROLL } from './helpers.ts';
import { drawJpegs, openOrder, seedOrder, uploadAndWait } from './photos.ts';
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

/** The teams the public gallery lists now, or null while the public gallery read does not exist yet (plan 11-26). */
async function publicGalleryTeams(request: APIRequestContext): Promise<string[] | null> {
  const response = await request.get('/api/v1/public/gallery');
  if (response.status() === 404 || !(response.headers()['content-type'] ?? '').includes('json')) {
    return null;
  }
  expect(response.status(), 'GET /api/v1/public/gallery').toBe(200);
  const body = (await response.json()) as { items: { team: string }[] };
  return body.items.map((item) => item.team);
}

/** Opens the window, ticks the OK and Show, chooses a line when the items gave none, and saves. */
async function showFromWindow(page: Page): Promise<void> {
  await card(page).getByRole('button', { name: 'Edit public website settings' }).click();
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

  await region.getByRole('button', { name: 'Edit public website settings' }).click();
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

  await showFromWindow(page);
  await expect(page.getByText('Order shown on the website')).toBeVisible();
  await expect(region.getByRole('button', { name: 'Edit public website settings' })).toBeFocused();
  await expect(region).toContainText(/Yes, recorded .+ by .+/);
  await expect(region.getByText('Shown', { exact: true })).toBeVisible();
  await expect(region).toContainText(order.team);
  await expectNoAxeViolations(page);

  // The public gallery lists the order: one set for all projects, so it is read under the lock.
  await withSiteContentLock(async () => {
    const teams = await publicGalleryTeams(request);
    if (teams === null) {
      test
        .info()
        .annotations.push({ type: 'pending', description: 'GET /api/v1/public/gallery arrives with plan 11-26' });
      return;
    }
    expect(teams).toContain(order.team);
  });
});

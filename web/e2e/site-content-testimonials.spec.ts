// Site Content, the Testimonials tab, end to end (CONT-03, PUB-03, D-05; plan 11-24), in all five projects. A Manager adds a testimonial, moves it to
// the top, and the public Home data shows it first; then hides, shows and deletes it. The testimonials are one set for every project, so a test
// that reads or changes them runs under the site content lock and puts the demo testimonials back at the end (seedDemoSiteContent also deletes
// every testimonial whose name starts with "E2E-"). Signing in takes the longest, so every test signs in before it takes the lock. Every test
// runs under the shared guard (console, page errors, CSP, failed responses).
import type { APIRequestContext, Page } from '@playwright/test';
import { signInAs } from './auth.ts';
import { expect, expectNoAxeViolations, test } from './fixtures.ts';
import { NO_SIDEWAYS_SCROLL, press } from './helpers.ts';
import { withSiteContentLock } from './site-content-lock.ts';
import { createStaff, seedDemoSiteContent } from './testing-api.ts';

/** A save goes through the host and the shared database, which other test runs on this machine may be using: give its toast longer than the 5 second default. */
const SAVE_WAIT_MS = 20_000;

// Each test waits its turn for the site content lock and signs in, so the 30 second default is not enough.
test.describe.configure({ timeout: 480_000 });

const E2E_NAME = 'E2E-Ana';
const E2E_QUOTE = 'E2E: the jerseys came out sharp and on time.';

/** Opens Site Content from the navigation (the sidebar, or the drawer on a phone) and then its Testimonials tab. */
async function openTestimonialsTab(page: Page): Promise<void> {
  const menu = page.getByRole('button', { name: 'Open navigation' });
  const sidebarLink = page.locator('aside nav[aria-label="Admin"]').getByRole('link', { name: /^Site Content/ });
  // The shell may still be laying out: wait for whichever navigation this width shows before choosing.
  await expect(menu.or(sidebarLink)).toBeVisible();
  if (await menu.isVisible()) {
    await menu.click();
    await page
      .getByRole('dialog', { name: 'Navigation' })
      .getByRole('link', { name: /^Site Content/ })
      .click();
  } else {
    await sidebarLink.click();
  }
  await expect(page.getByRole('heading', { level: 1, name: 'Site Content' })).toBeVisible();
  await page.getByRole('tab', { name: 'Testimonials' }).click();
  await expect(page).toHaveURL(/tab=testimonials/);
  await expect(page.getByRole('table', { name: 'Testimonials' })).toBeVisible();
}

/** The quotes of the testimonials the public Home page shows, in order (the first three shown). */
async function publicHomeQuotes(request: APIRequestContext): Promise<string[]> {
  const response = await request.get('/api/v1/public/home');
  expect(response.status()).toBe(200);
  return ((await response.json()) as { testimonials: { quote: string }[] }).testimonials.map((item) => item.quote);
}

/** Adds E2E-Ana through the window: the form is filled by its field names. */
async function addE2eTestimonial(page: Page): Promise<void> {
  await page.getByRole('button', { name: 'Add Testimonial' }).click();
  const dialog = page.getByRole('dialog', { name: 'Add Testimonial' });
  await expect(dialog.getByRole('radio', { name: '5 stars' })).toBeChecked();
  await expect(dialog.getByRole('checkbox', { name: 'Show on the website' })).toBeChecked();
  await dialog.getByLabel(/^Quote/).fill(E2E_QUOTE);
  await dialog.getByLabel(/^Name/).fill(E2E_NAME);
  await dialog.getByLabel(/^Team or role/).fill('Captain, E2E Sample Club');
  await press(page, dialog.getByRole('button', { name: 'Save Testimonial' }));
  await expect(page.getByText('Testimonial added')).toBeVisible({ timeout: SAVE_WAIT_MS });
  await expect(page.getByText('The Home page shows the change.')).toBeVisible();
}

test('@site-content-testimonials a Manager adds E2E-Ana, moves it to the top, and the public Home data shows it first', async ({
  page,
  request,
  guard,
}) => {
  guard.expectStatus('/api/v1/auth/refresh', 401);
  await signInAs(page, request, await createStaff(request, 'Manager'));
  await withSiteContentLock(async () => {
    try {
      await seedDemoSiteContent(request);
      await openTestimonialsTab(page);
      const table = page.getByRole('table', { name: 'Testimonials' });
      await expect(table.locator('tbody tr')).toHaveCount(4);

      await addE2eTestimonial(page);
      await expect(table.locator('tbody tr')).toHaveCount(5);
      await expect(page.getByRole('button', { name: `Edit testimonial from ${E2E_NAME}` })).toBeFocused();
      // The demo has three shown testimonials and one hidden: the new one is last, so it is not on the Home page yet.
      expect(await publicHomeQuotes(request)).not.toContain(E2E_QUOTE);

      // Move it up four places, one press at a time: focus stays on Move up and the polite line says where it is.
      for (const position of [4, 3, 2, 1]) {
        await press(page, page.getByRole('button', { name: `Move testimonial from ${E2E_NAME} up` }));
        await expect(
          page.getByText(`Testimonial from ${E2E_NAME} moved to position ${String(position)} of 5.`),
        ).toBeAttached({
          timeout: SAVE_WAIT_MS,
        });
        if (position > 1) {
          await expect(page.getByRole('button', { name: `Move testimonial from ${E2E_NAME} up` })).toBeFocused();
        }
      }
      // At the top Move up is aria-disabled and focus went to Move down.
      await expect(page.getByRole('button', { name: `Move testimonial from ${E2E_NAME} up` })).toHaveAttribute(
        'aria-disabled',
        'true',
      );
      await expect(page.getByRole('button', { name: `Move testimonial from ${E2E_NAME} down` })).toBeFocused();
      await expect(table.locator('tbody tr').first()).toContainText(E2E_NAME);
      await expect(table.locator('tbody tr').first()).toContainText('On the Home page');

      // PUB-03: the public Home data, which the Home page draws from, now starts with the new quote.
      expect((await publicHomeQuotes(request))[0]).toBe(E2E_QUOTE);
    } finally {
      await seedDemoSiteContent(request);
    }
  });
});

test('@site-content-testimonials a Manager hides E2E-Ana and it leaves the public Home data, shows it again, then deletes it', async ({
  page,
  request,
  guard,
}) => {
  guard.expectStatus('/api/v1/auth/refresh', 401);
  await signInAs(page, request, await createStaff(request, 'Manager'));
  await withSiteContentLock(async () => {
    try {
      await seedDemoSiteContent(request);
      await openTestimonialsTab(page);
      await addE2eTestimonial(page);
      const row = page.getByRole('row').filter({ hasText: E2E_NAME });
      await expect(row.getByText('Shown', { exact: true })).toBeVisible();

      // Hide: no question, the toast, the badge, and focus stays on the toggle, now Show.
      await press(page, page.getByRole('button', { name: `Hide testimonial from ${E2E_NAME}` }));
      await expect(page.getByText('Testimonial hidden')).toBeVisible({ timeout: SAVE_WAIT_MS });
      await expect(row.getByText('Hidden', { exact: true })).toBeVisible();
      await expect(page.getByRole('button', { name: `Show testimonial from ${E2E_NAME}` })).toBeFocused();
      expect(await publicHomeQuotes(request)).not.toContain(E2E_QUOTE);

      // Show it again.
      await press(page, page.getByRole('button', { name: `Show testimonial from ${E2E_NAME}` }));
      await expect(page.getByText('Testimonial shown')).toBeVisible({ timeout: SAVE_WAIT_MS });
      await expect(row.getByText('Shown', { exact: true })).toBeVisible();
      await expect(page.getByRole('button', { name: `Hide testimonial from ${E2E_NAME}` })).toBeFocused();

      // Edit: the window opens on the saved words, and a save keeps the row.
      await press(page, page.getByRole('button', { name: `Edit testimonial from ${E2E_NAME}` }));
      const dialog = page.getByRole('dialog', { name: 'Edit Testimonial' });
      await expect(dialog.getByLabel(/^Quote/)).toHaveValue(E2E_QUOTE);
      await dialog.getByLabel(/^Team or role/).fill('Coach, E2E Sample Club');
      await press(page, dialog.getByRole('button', { name: 'Save Testimonial' }));
      await expect(page.getByText('Testimonial saved')).toBeVisible({ timeout: SAVE_WAIT_MS });
      await expect(row).toContainText('Coach, E2E Sample Club');

      // Delete: the question focuses Cancel first and names the person and the start of the quote; the row is gone for good.
      await press(page, page.getByRole('button', { name: `Delete testimonial from ${E2E_NAME}` }));
      const question = page.getByRole('dialog', { name: 'Delete this testimonial?' });
      await expect(question.getByRole('button', { name: 'Cancel' })).toBeFocused();
      await expect(question).toContainText(`${E2E_NAME}: “${E2E_QUOTE}” It's removed for good.`);
      await press(page, question.getByRole('button', { name: 'Delete Testimonial' }));
      await expect(page.getByText('Testimonial deleted')).toBeVisible({ timeout: SAVE_WAIT_MS });
      await expect(page.getByRole('button', { name: `Edit testimonial from ${E2E_NAME}` })).toHaveCount(0);
      expect(await publicHomeQuotes(request)).not.toContain(E2E_QUOTE);
    } finally {
      await seedDemoSiteContent(request);
    }
  });
});

// This one only looks at the layout, which any testimonials give, so it does not take the lock.
test('@site-content-testimonials at 390px the list is row cards, and at 320px the page has no sideways scroll and axe finds nothing', async ({
  page,
  request,
  guard,
}) => {
  guard.expectStatus('/api/v1/auth/refresh', 401);
  await signInAs(page, request, await createStaff(request, 'Manager'));
  await page.setViewportSize({ width: 390, height: 844 });
  await openTestimonialsTab(page);

  // Phone: no header row, each cell on its own line with its label.
  await expect(page.locator('thead')).toBeHidden();
  await expect(page.locator('td[data-label="Stars"]').first()).toHaveCSS('display', 'flex');
  expect(await page.evaluate<boolean>(NO_SIDEWAYS_SCROLL)).toBe(true);

  // The quote is clamped to two lines.
  await expect(page.locator('td[data-label="Quote"] .line-clamp-2').first()).toHaveCSS('-webkit-line-clamp', '2');

  await page.setViewportSize({ width: 320, height: 640 });
  await expect(page.getByRole('table', { name: 'Testimonials' })).toBeAttached();
  expect(await page.evaluate<boolean>(NO_SIDEWAYS_SCROLL)).toBe(true);
  await expectNoAxeViolations(page);
});

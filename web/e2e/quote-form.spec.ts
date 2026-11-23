// Get a Quote form E2E (INQ-01, INQ-08, D-35, UI-SPEC Q1 and Q3): a visitor sends a request from the Contact page to the real API.
// The host runs with the quote limits lifted and a one second minimum time (playwright.config.ts), so every project can send.
import { expect, test } from './fixtures.ts';

/** A Philippine mobile number nobody used before in this run, so the per-sender limit never meets it. */
function freshMobile(): string {
  const tail = String(Math.floor(Math.random() * 1_000_000_000)).padStart(9, '0');
  return `09${tail}`;
}

test('@quote a visitor sends a text-only inquiry and sees Inquiry sent', async ({ page }) => {
  await page.goto('/contact');

  const form = page.getByRole('form', { name: 'Inquiry form' });
  await expect(form).toBeVisible();
  await form.getByRole('textbox', { name: /Your name/ }).fill('Juan Dela Cruz');
  await form.getByRole('textbox', { name: /Contact number/ }).fill(freshMobile());
  const sent = page.waitForResponse(
    (response) => response.url().endsWith('/api/v1/public/quote-requests') && response.request().method() === 'POST',
  );
  await form.getByRole('button', { name: 'Send Inquiry' }).click();

  const answer = await sent;
  expect(answer.status()).toBe(200);
  expect(((await answer.json()) as { id: string }).id).toMatch(/^[0-9a-f-]{36}$/);
  const title = page.getByRole('heading', { level: 2, name: 'Inquiry sent' });
  await expect(title).toBeVisible();
  await expect(title).toBeFocused();
  await expect(
    page.getByText("Thanks! We'll message you with a mockup and quote, usually the same day."),
  ).toBeVisible();
  await expect(page.getByText("We'll message you soon.")).toBeVisible();

  await page.getByRole('button', { name: 'Send Another' }).click();
  await expect(page.getByRole('textbox', { name: /Your name/ })).toBeFocused();
  await expect(page.getByRole('textbox', { name: /Your name/ })).toHaveValue('');
});

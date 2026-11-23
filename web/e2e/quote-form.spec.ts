// Get a Quote form E2E (INQ-01, INQ-08, D-35, UI-SPEC Q1 and Q3): a visitor sends a request from the Contact page to the real API.
// The host runs with the quote limits lifted and a one second minimum time (playwright.config.ts), so every project can send.
import { expect, expectNoAxeViolations, test } from './fixtures.ts';
import { drawJpeg } from './photos.ts';

// A page script as text: the node program has no DOM types.
const SIDEWAYS_OVERFLOW = 'document.documentElement.scrollWidth - document.documentElement.clientWidth';

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

test('@quote a visitor sends an inquiry with a photo: the create and the upload answer 200 and no photo is named missing', async ({
  page,
}) => {
  await page.goto('/contact');

  const form = page.getByRole('form', { name: 'Inquiry form' });
  await expect(form).toBeVisible();
  await form.getByRole('textbox', { name: /Your name/ }).fill('Juan Dela Cruz');
  await form.getByRole('textbox', { name: /Contact number/ }).fill(freshMobile());
  const photo = await drawJpeg(page, 'logo.jpg', 200, 600, 400);
  await form.locator('input[type="file"]').setInputFiles([photo]);
  await expect(form.getByRole('list', { name: 'Photos to send' }).getByRole('listitem')).toHaveCount(1);
  const create = page.waitForResponse(
    (response) => response.url().endsWith('/api/v1/public/quote-requests') && response.request().method() === 'POST',
  );
  const upload = page.waitForResponse((response) =>
    /\/api\/v1\/public\/quote-requests\/[0-9a-f-]{36}\/photos\/0$/.test(response.url()),
  );
  await form.getByRole('button', { name: 'Send Inquiry' }).click();

  expect((await create).status()).toBe(200);
  expect((await upload).status()).toBe(200);
  await expect(page.getByRole('heading', { level: 2, name: 'Inquiry sent' })).toBeVisible();
  await expect(page.getByText(/didn't upload/)).toHaveCount(0);
});

// The shared host runs with the quote limits lifted and cannot lower them for one test, so the create answers 429 from the page's
// network layer, in the server's own words.
test('@quote the rate limit keeps what the visitor typed', async ({ page, guard }) => {
  guard.expectStatus('/api/v1/public/quote-requests', 429);
  await page.route('**/api/v1/public/quote-requests', (route) =>
    route.request().method() === 'POST'
      ? route.fulfill({
          status: 429,
          contentType: 'application/problem+json',
          body: JSON.stringify({
            title: 'Too many attempts from this address. Please wait and try again.',
            status: 429,
            code: 'rate-limited',
          }),
        })
      : route.fallback(),
  );
  await page.goto('/contact');

  const form = page.getByRole('form', { name: 'Inquiry form' });
  await form.getByRole('textbox', { name: /Your name/ }).fill('Juan Dela Cruz');
  const number = freshMobile();
  await form.getByRole('textbox', { name: /Contact number/ }).fill(number);
  const send = form.getByRole('button', { name: 'Send Inquiry' });
  await send.click();

  const alert = form.getByRole('alert');
  await expect(alert).toContainText(
    "You've sent a few requests in a short time. Wait a few minutes and try again, or message us on Messenger.",
  );
  await expect(form.getByRole('textbox', { name: /Your name/ })).toHaveValue('Juan Dela Cruz');
  await expect(form.getByRole('textbox', { name: /Contact number/ })).toHaveValue(number);
  await expect(send).toBeFocused();
  await expectNoAxeViolations(page);
});

test('@quote at 320px the form comes first, the fields stack in one column and nothing scrolls sideways', async ({
  page,
}) => {
  await page.setViewportSize({ width: 320, height: 700 });
  await page.goto('/contact');

  const form = page.getByRole('form', { name: 'Inquiry form' });
  await expect(form).toBeVisible();
  const formBox = await form.boundingBox();
  const asideBox = await page.getByRole('complementary').boundingBox();
  const nameBox = await form.getByRole('textbox', { name: /Your name/ }).boundingBox();
  const teamBox = await form.getByRole('textbox', { name: 'Team / organization' }).boundingBox();
  expect(formBox).not.toBeNull();
  expect(asideBox).not.toBeNull();
  expect(nameBox?.x).toBe(teamBox?.x);
  expect((asideBox?.y ?? 0) + 1).toBeGreaterThanOrEqual((formBox?.y ?? 0) + (formBox?.height ?? 0));
  expect(await page.evaluate(SIDEWAYS_OVERFLOW)).toBeLessThanOrEqual(0);
  await expectNoAxeViolations(page);
});

test('@quote at 1440px the form card is on the left and the aside is beside it', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto('/contact');

  const form = page.getByRole('form', { name: 'Inquiry form' });
  await expect(form).toBeVisible();
  const formBox = await form.boundingBox();
  const asideBox = await page.getByRole('complementary').boundingBox();
  expect(formBox).not.toBeNull();
  expect(asideBox).not.toBeNull();
  expect((formBox?.x ?? 0) + (formBox?.width ?? 0)).toBeLessThanOrEqual(asideBox?.x ?? 0);
  expect(Math.abs((formBox?.y ?? 0) - (asideBox?.y ?? 0))).toBeLessThanOrEqual(2);
  expect(await page.evaluate(SIDEWAYS_OVERFLOW)).toBeLessThanOrEqual(0);
  await expectNoAxeViolations(page);
});

test('@quote the header Get a Quote, pressed on the Contact page, focuses Your name', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto('/contact');
  await expect(page.getByRole('form', { name: 'Inquiry form' })).toBeVisible();

  await page.getByRole('banner').getByRole('button', { name: 'Get a Quote' }).click();

  await expect(page.getByRole('textbox', { name: /Your name/ })).toBeFocused();
  expect(new URL(page.url()).pathname).toBe('/contact');
});

test('@quote a send with a bad number shows the server words before any request and keeps what was typed', async ({
  page,
}) => {
  await page.goto('/contact');
  const form = page.getByRole('form', { name: 'Inquiry form' });
  await form.getByRole('textbox', { name: /Your name/ }).fill('Juan Dela Cruz');
  await form.getByRole('textbox', { name: /Contact number/ }).fill('02 8123 4567');
  let sent = false;
  page.on('request', (request) => {
    if (request.method() === 'POST' && request.url().includes('/api/v1/public/quote-requests')) {
      sent = true;
    }
  });

  await form.getByRole('button', { name: 'Send Inquiry' }).click();

  await expect(form.getByText('Enter a mobile number, like 0917 123 4567.')).toBeVisible();
  await expect(form.getByRole('textbox', { name: /Contact number/ })).toBeFocused();
  await expect(form.getByRole('textbox', { name: /Your name/ })).toHaveValue('Juan Dela Cruz');
  expect(sent).toBe(false);
});

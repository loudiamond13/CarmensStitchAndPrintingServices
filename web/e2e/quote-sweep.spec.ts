// Phase 13 quote sweep (INQ-01 to INQ-08, D-35, ANL-05; WCAG 2.2 AA; plan 13-24), in all five projects. The public Contact form at
// rest, with every field error, with a refused photo and after success; the staff inbox on Open, All, an empty pill and a search with no
// match; request pages New with photos and notes, with missing photos, Spam and Converted; and the Spam and Delete dialogs open, the
// admin ones in Blush and Espresso. Each state is checked at 320, 390, 820, 1440 and 1920 px for axe (target-size included), one h1 and
// no sideways scroll, and for console, page and CSP findings. The privacy checks: the request page title has no customer name, the inbox
// URL carries personal data only in q, and the page-view beacon sends the path only.
import type { Page } from '@playwright/test';
import { expect, expectNoAxeViolations, type Guard, listFindings, test } from './fixtures.ts';
import { freshMobile, NO_SIDEWAYS_SCROLL, press, uniqueWord } from './helpers.ts';
import { drawJpeg } from './photos.ts';
import { settle } from './sweep.ts';

// Five widths, an axe run at each, for several states: more than the 30 second default.
test.describe.configure({ timeout: 480_000 });

const WIDTHS = [320, 390, 820, 1440, 1920] as const;

const PAGE_VIEWS = '/api/v1/analytics/page-views';

async function axeProblem(page: Page): Promise<string | null> {
  try {
    await expectNoAxeViolations(page);
    return null;
  } catch (error) {
    return error instanceof Error ? error.message : String(error);
  }
}

/** Checks the open page at every width and returns what is wrong, one line each, including what the guard recorded so far. */
async function sweepOpenPage(page: Page, guard: Guard, label: string): Promise<string[]> {
  const failures: string[] = [];
  for (const width of WIDTHS) {
    await page.setViewportSize({ width, height: width >= 1024 ? 900 : 800 });
    await settle(page);
    if (!(await page.evaluate<boolean>(NO_SIDEWAYS_SCROLL))) {
      failures.push(`${label} at ${String(width)} px: the page scrolls sideways`);
    }
    const headings = await page.locator('h1').count();
    if (headings !== 1) {
      failures.push(`${label} at ${String(width)} px: ${String(headings)} h1 elements`);
    }
    const axe = await axeProblem(page);
    if (axe !== null) {
      failures.push(`${label} at ${String(width)} px: ${axe}`);
    }
  }
  const findings = listFindings(await guard.peek());
  if (findings.length > 0) {
    failures.push(`${label}: ${findings.join('; ')}`);
  }
  return failures;
}

/** Records every page-view beacon body the page sends. */
function recordPageViews(page: Page): string[] {
  const bodies: string[] = [];
  page.on('request', (seen) => {
    if (seen.method() === 'POST' && seen.url().includes(PAGE_VIEWS)) {
      bodies.push(seen.postData() ?? '');
    }
  });
  return bodies;
}

// Sums the layout shifts the page reports without recent input, from the first paint (buffered). Only Chromium reports them.
const LAYOUT_SHIFT_OBSERVER = `
  window.__cspsLayoutShift = 0;
  window.__cspsLayoutShiftSupported = PerformanceObserver.supportedEntryTypes.includes('layout-shift');
  if (window.__cspsLayoutShiftSupported) {
    new PerformanceObserver((list) => {
      for (const entry of list.getEntries()) {
        if (!entry.hadRecentInput) {
          window.__cspsLayoutShift += entry.value;
        }
      }
    }).observe({ type: 'layout-shift', buffered: true });
  }
`;

/** Opens Contact and waits for the form piece and the fonts. */
async function openContact(page: Page): Promise<void> {
  await page.setViewportSize({ width: 390, height: 800 });
  const response = await page.goto('/contact');
  expect(response?.status()).toBe(200);
  await expect(page.getByRole('form', { name: 'Inquiry form' })).toBeVisible();
  await page.evaluate('document.fonts.ready.then(() => true)');
  await settle(page);
}

test('@quote Contact at rest: no finding from 320 to 1920 px, CLS under 0.05 while the form loads, and the beacon sends the path only', async ({
  page,
  guard,
  browserName,
}) => {
  await page.addInitScript({ content: LAYOUT_SHIFT_OBSERVER });
  const views = recordPageViews(page);
  await openContact(page);

  // D-35: the form piece loads into a card of the same size, so nothing shifts. Chromium (desktop and Pixel) reports the shifts.
  const supported = await page.evaluate<boolean>('window.__cspsLayoutShiftSupported');
  if (browserName === 'chromium') {
    expect(supported, 'Chromium reports layout shifts').toBe(true);
  }
  if (supported) {
    expect(await page.evaluate<number>('window.__cspsLayoutShift'), 'layout shift while the form loads').toBeLessThan(
      0.05,
    );
  }

  expect(await sweepOpenPage(page, guard, 'Contact at rest')).toEqual([]);
  // ANL-05: the beacon body is the path and nothing else.
  await expect.poll(() => views).toContain('{"path":"/contact"}');
  expect(
    views.every((body) => body === '{"path":"/contact"}'),
    views.join(' '),
  ).toBe(true);
});

test('@quote Contact with every field error: no finding from 320 to 1920 px', async ({ page, guard }) => {
  await openContact(page);
  const form = page.getByRole('form', { name: 'Inquiry form' });
  await form.getByRole('textbox', { name: /^Email/ }).fill('not-an-email');
  await form.getByRole('textbox', { name: /^Message/ }).fill('x'.repeat(2001));
  let sent = false;
  page.on('request', (request) => {
    if (request.method() === 'POST' && request.url().endsWith('/api/v1/public/quote-requests')) {
      sent = true;
    }
  });
  await press(page, form.getByRole('button', { name: 'Send Inquiry' }));

  // Name and number missing, the email and the message refused: every check the browser makes, and nothing sent (OR-3).
  await expect(form.locator('[aria-invalid="true"]')).toHaveCount(4);
  await expect(form.getByRole('textbox', { name: /Your name/ })).toBeFocused();
  expect(await sweepOpenPage(page, guard, 'Contact with every field error')).toEqual([]);
  expect(sent).toBe(false);
});

test('@quote Contact with a refused photo: no finding from 320 to 1920 px', async ({ page, guard }) => {
  await openContact(page);
  const form = page.getByRole('form', { name: 'Inquiry form' });
  const photo = await drawJpeg(page, 'logo.jpg', 200, 600, 400);
  // Text with a photo name: the picker reads the first bytes, so it is refused.
  const notPhoto = { name: 'design.png', mimeType: 'image/png', buffer: Buffer.from('not a picture at all') };
  await form.locator('input[type="file"]').setInputFiles([photo, notPhoto]);

  await expect(form.getByRole('list', { name: 'Photos to send' }).getByRole('listitem')).toHaveCount(1);
  await expect(form.getByRole('alert')).toContainText('design.png');
  expect(await sweepOpenPage(page, guard, 'Contact with a refused photo')).toEqual([]);
});

test('@quote Contact after a send: no finding from 320 to 1920 px, and no beacon carries what was typed', async ({
  page,
  guard,
}) => {
  const views = recordPageViews(page);
  await openContact(page);
  const form = page.getByRole('form', { name: 'Inquiry form' });
  const name = `E2E Sweep ${uniqueWord()}`;
  const number = freshMobile();
  await form.getByRole('textbox', { name: /Your name/ }).fill(name);
  await form.getByRole('textbox', { name: /Contact number/ }).fill(number);
  const created = page.waitForResponse(
    (response) => response.url().endsWith('/api/v1/public/quote-requests') && response.request().method() === 'POST',
  );
  await press(page, form.getByRole('button', { name: 'Send Inquiry' }));
  expect((await created).status()).toBe(200);
  await expect(page.getByRole('heading', { level: 2, name: 'Inquiry sent' })).toBeFocused();

  expect(await sweepOpenPage(page, guard, 'Contact after a send')).toEqual([]);
  expect(new URL(page.url()).pathname).toBe('/contact');
  expect(page.url()).not.toContain(number);
  const sentViews = views.join(' ');
  expect(sentViews).not.toContain(number);
  expect(sentViews).not.toContain(name.split(' ').at(-1) ?? name);
  expect(
    views.every((body) => body === '{"path":"/contact"}'),
    sentViews,
  ).toBe(true);
});

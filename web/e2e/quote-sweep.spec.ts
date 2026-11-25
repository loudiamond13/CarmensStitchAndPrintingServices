// Phase 13 quote sweep (INQ-01 to INQ-08, D-35, ANL-05; WCAG 2.2 AA; plan 13-24), in all five projects. The public Contact form at
// rest, with every field error, with a refused photo and after success; the staff inbox on Open, All, an empty pill and a search with no
// match; request pages New with photos and notes, with missing photos, Spam and Converted; and the Spam and Delete dialogs open, the
// admin ones in Blush and Espresso. Each state is checked at 320, 390, 820, 1440 and 1920 px for axe (target-size included), one h1 and
// no sideways scroll, and for console, page and CSP findings. The privacy checks: the request page title has no customer name, the inbox
// URL carries personal data only in q, and the page-view beacon sends the path only.
import type { APIRequestContext, Page } from '@playwright/test';
import { signInAs } from './auth.ts';
import { expect, expectNoAxeViolations, type Guard, listFindings, test } from './fixtures.ts';
import { freshMobile, manilaDate, NO_SIDEWAYS_SCROLL, press, uniqueWord } from './helpers.ts';
import { withPhotoHost } from './photo-host-lock.ts';
import { apiToken, drawJpeg } from './photos.ts';
import { withSiteContentLock } from './site-content-lock.ts';
import { settle } from './sweep.ts';
import {
  addQuoteNote,
  changeQuoteStatus,
  convertQuoteRequest,
  createQuoteRequest,
  createStaff,
  type QuoteSeedInput,
  seedDemoSiteContent,
} from './testing-api.ts';

// Five widths, an axe run at each, for several states: more than the 30 second default.
test.describe.configure({ timeout: 480_000 });

const WIDTHS = [320, 390, 820, 1440, 1920] as const;
const THEMES = ['light', 'dark'] as const;
type Theme = (typeof THEMES)[number];

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
  request,
  guard,
  browserName,
}) => {
  await withSiteContentLock(async () => {
    await seedDemoSiteContent(request);
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
});

test('@quote Contact with every field error: no finding from 320 to 1920 px', async ({ page, request, guard }) => {
  await withSiteContentLock(async () => {
    await seedDemoSiteContent(request);
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
});

test('@quote Contact with a refused photo: no finding from 320 to 1920 px', async ({ page, request, guard }) => {
  await withSiteContentLock(async () => {
    await seedDemoSiteContent(request);
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
});

test('@quote Contact after a send: no finding from 320 to 1920 px, and no beacon carries what was typed', async ({
  page,
  request,
  guard,
}) => {
  await withSiteContentLock(async () => {
    await seedDemoSiteContent(request);
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
});

// ── The staff screens ──

/** Signs in a fresh Manager (Delete Request is a Manager action) and stores the admin theme for the next load. */
async function signInManager(page: Page, request: APIRequestContext, theme: Theme): Promise<void> {
  await signInAs(page, request, await createStaff(request, 'Manager'));
  await page.evaluate(`localStorage.setItem('csps-theme', '${theme}')`);
}

/** Opens an admin path and waits for the theme and the fonts. */
async function openAdmin(page: Page, theme: Theme, path: string): Promise<void> {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto(path);
  await expect(page.locator('[data-theme]').first()).toHaveAttribute('data-theme', theme);
  await page.evaluate('document.fonts.ready.then(() => true)');
}

/** Sends a request with one stored photo, under the photo host lock. */
async function requestWithPhoto(page: Page, request: APIRequestContext, input: QuoteSeedInput): Promise<string> {
  const photo = await drawJpeg(page, 'front.jpg', 200, 1200, 800);
  return withPhotoHost(() => createQuoteRequest(request, { ...input, photos: [photo] }));
}

function themeName(theme: Theme): string {
  return theme === 'light' ? 'Blush' : 'Espresso';
}

for (const theme of THEMES) {
  test(`@quote the inbox on Open, All, an empty pill and a search with no match: no finding from 320 to 1920 px, and the URL holds personal data only in q, in ${themeName(theme)}`, async ({
    page,
    request,
    guard,
  }) => {
    guard.expectStatus('/api/v1/auth/refresh', 401);
    await signInManager(page, request, theme);
    const word = uniqueWord();
    const openName = `E2E Sweep ${word} Open`;
    const spamName = `E2E Sweep ${word} Spam`;
    await createQuoteRequest(request, { customerName: openName, contactNumber: freshMobile(), teamName: 'E2E Riders' });
    const spam = await createQuoteRequest(request, { customerName: spamName, contactNumber: freshMobile() });
    await changeQuoteStatus(request, await apiToken(page), spam, 'spam');
    const failures: string[] = [];

    await openAdmin(page, theme, '/admin/quote-requests');
    await expect(page.getByRole('heading', { level: 1, name: 'Quote Requests' })).toBeVisible();
    await expect(page.getByRole('link', { name: openName })).toBeVisible();
    failures.push(...(await sweepOpenPage(page, guard, `Inbox Open (${theme})`)));

    await openAdmin(page, theme, `/admin/quote-requests?status=all&q=${word}`);
    await expect(page.getByRole('link', { name: spamName })).toBeVisible();
    await expect(page.getByRole('link', { name: openName })).toBeVisible();
    failures.push(...(await sweepOpenPage(page, guard, `Inbox All (${theme})`)));

    // No spec closes a request and each e2e run starts from a fresh CSPS_E2E, so the Closed pill is empty.
    await openAdmin(page, theme, '/admin/quote-requests?status=closed');
    await expect(page.getByRole('heading', { name: 'No closed requests' })).toBeVisible();
    failures.push(...(await sweepOpenPage(page, guard, `Inbox empty Closed pill (${theme})`)));

    const nobody = uniqueWord();
    await openAdmin(page, theme, `/admin/quote-requests?q=${nobody}`);
    await expect(page.getByRole('heading', { name: `No requests match "${nobody}"` })).toBeVisible();
    failures.push(...(await sweepOpenPage(page, guard, `Inbox search with no match (${theme})`)));
    expect(failures).toEqual([]);

    // Searched from the box: the name rides only in q, never in the path or any other part of the address (CWE-598).
    await openAdmin(page, theme, '/admin/quote-requests');
    const search = page.getByRole('searchbox', { name: 'Search requests' });
    await search.fill(openName);
    await search.press('Enter');
    await expect(page).toHaveURL(/[?&]q=/);
    await expect(page.getByRole('link', { name: openName })).toBeVisible();
    const address = new URL(page.url());
    expect(address.searchParams.get('q')).toBe(openName);
    expect(decodeURIComponent(address.pathname + address.hash)).not.toContain(word);
    for (const [key, value] of address.searchParams) {
      if (key !== 'q') {
        expect(value, `the ${key} parameter`).not.toContain(word);
      }
    }
    await expect(page).not.toHaveTitle(new RegExp(word));
  });

  test(`@quote the request pages New with photos and notes, with missing photos, Spam and Converted: no finding from 320 to 1920 px, and no customer name in the title, in ${themeName(theme)}`, async ({
    page,
    request,
    guard,
  }) => {
    guard.expectStatus('/api/v1/auth/refresh', 401);
    await signInManager(page, request, theme);
    const word = uniqueWord();
    const withPhotos = `E2E Sweep ${word} Photos`;
    const missing = `E2E Sweep ${word} Missing`;
    const spamName = `E2E Sweep ${word} Spam`;
    const convertedName = `E2E Sweep ${word} Converted`;
    const photosId = await requestWithPhoto(page, request, {
      customerName: withPhotos,
      contactNumber: freshMobile(),
      teamName: 'E2E Riders',
      message: 'Twelve jerseys, numbers 1 to 12.',
    });
    const token = await apiToken(page);
    await addQuoteNote(request, token, photosId, 'Called back. Wants 12 jerseys by Friday.');
    const missingId = await createQuoteRequest(request, {
      customerName: missing,
      contactNumber: freshMobile(),
      declaredPhotos: ['logo.png', 'back.png'],
    });
    const spamId = await createQuoteRequest(request, { customerName: spamName, contactNumber: freshMobile() });
    await changeQuoteStatus(request, token, spamId, 'spam');
    const convertedNumber = freshMobile();
    const convertedId = await createQuoteRequest(request, {
      customerName: convertedName,
      contactNumber: convertedNumber,
    });
    await convertQuoteRequest(request, token, convertedId, {
      customerName: convertedName,
      contactNumber: convertedNumber,
      orderDate: manilaDate(0),
      dueDate: manilaDate(5),
    });

    const cases = [
      {
        label: 'New with photos and notes',
        id: photosId,
        name: withPhotos,
        ready: async () => {
          const tile = page.getByRole('region', { name: 'Photos' }).getByRole('button', { name: /^Open photo 1 of 1/ });
          await expect(tile.locator('img')).toHaveJSProperty('complete', true);
          await expect(page.getByRole('region', { name: 'Internal notes' })).toContainText('Called back.');
        },
      },
      {
        label: 'with missing photos',
        id: missingId,
        name: missing,
        ready: async () => {
          await expect(page.getByRole('region', { name: 'Photos' })).toContainText("2 photos didn't upload");
        },
      },
      {
        label: 'Spam',
        id: spamId,
        name: spamName,
        ready: async () => {
          await expect(page.getByRole('region', { name: 'History' })).toContainText('Spam ·');
        },
      },
      {
        label: 'Converted',
        id: convertedId,
        name: convertedName,
        ready: async () => {
          await expect(page.getByRole('link', { name: /^Open Order ORD-/ })).toBeVisible();
        },
      },
    ];
    const failures: string[] = [];
    for (const { label, id, name, ready } of cases) {
      await openAdmin(page, theme, `/admin/quote-requests/${id}`);
      await expect(page.getByRole('heading', { level: 1, name })).toBeVisible();
      await ready();
      // The visitor's name is personal data: it never reaches the document title or the address (CWE-598).
      await expect(page).toHaveTitle('Quote Request · CSPS Admin');
      expect(decodeURIComponent(page.url())).not.toContain(word);
      failures.push(...(await sweepOpenPage(page, guard, `Request ${label} (${theme})`)));
    }
    expect(failures).toEqual([]);
  });

  test(`@quote the Spam and Delete dialogs open: no finding from 320 to 1920 px, in ${themeName(theme)}`, async ({
    page,
    request,
    guard,
  }) => {
    guard.expectStatus('/api/v1/auth/refresh', 401);
    await signInManager(page, request, theme);
    const name = `E2E Sweep ${uniqueWord()} Dialogs`;
    const id = await requestWithPhoto(page, request, { customerName: name, contactNumber: freshMobile() });
    const failures: string[] = [];

    await openAdmin(page, theme, `/admin/quote-requests/${id}`);
    await expect(page.getByRole('heading', { level: 1, name })).toBeVisible();
    // A request with photos asks before Spam deletes them (D-04).
    await press(page, page.getByRole('button', { name: 'Change Status' }));
    await page.getByRole('menuitem', { name: 'Move to Spam' }).click();
    const spam = page.getByRole('dialog', { name: 'Mark this request as spam?' });
    await expect(spam).toBeVisible();
    failures.push(...(await sweepOpenPage(page, guard, `Spam dialog (${theme})`)));
    await spam.getByRole('button', { name: 'Cancel' }).click();
    await expect(spam).toHaveCount(0);

    await press(page, page.getByRole('button', { name: 'Delete Request' }));
    const remove = page.getByRole('dialog', { name: 'Delete this quote request?' });
    await expect(remove).toBeVisible();
    failures.push(...(await sweepOpenPage(page, guard, `Delete dialog (${theme})`)));
    await remove.getByRole('button', { name: 'Cancel' }).click();
    await expect(remove).toHaveCount(0);
    expect(failures).toEqual([]);
    // Both were cancelled, so the request and its photo are still there.
    await expect(page.getByRole('heading', { level: 1, name })).toBeVisible();
    await expect(
      page.getByRole('region', { name: 'Photos' }).getByRole('button', { name: /^Open photo 1 of 1/ }),
    ).toBeVisible();
  });
}

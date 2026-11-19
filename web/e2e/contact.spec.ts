// Contact and footer E2E (PUB-02, PUB-06, D-20, D-42): the shop facts reach a visitor's footer from the server's own HTML
// with no extra request, and Contact lets a visitor message or call the shop. Every test resets the demo shop facts and
// runs under the site content lock, because the singleton settings are shared by all five projects.
import { expect, expectNoAxeViolations, test } from './fixtures.ts';
import { withSiteContentLock } from './site-content-lock.ts';
import { seedDemoSiteContent } from './testing-api.ts';

// Every test takes the site content lock, which can take 6 minutes to get, so a test is allowed 8.
test.describe.configure({ timeout: 480_000 });

const SITE_API = '/api/v1/public/site';
const DEMO_TAGLINE = 'Custom tailoring and full-sublimation printing for teams, leagues and riding groups.';

test('@contact the footer shows the stored tagline and main phone from the first HTML, with no site request', async ({
  page,
  request,
}) => {
  await withSiteContentLock(async () => {
    await seedDemoSiteContent(request);
    const siteRequests: string[] = [];
    page.on('request', (seen) => {
      if (seen.url().includes(SITE_API)) {
        siteRequests.push(seen.url());
      }
    });

    await page.goto('/');

    const footer = page.getByRole('contentinfo');
    await expect(footer.getByText(DEMO_TAGLINE)).toBeVisible();
    await expect(footer.getByRole('link', { name: '0917 123 4567' })).toHaveAttribute('href', 'tel:+639171234567');
    await expect(footer.getByRole('link', { name: 'Message us on Messenger' })).toHaveAttribute(
      'href',
      'https://m.me/cspsdemo',
    );
    expect(await page.locator('body').innerText()).not.toContain('@');
    expect(siteRequests).toEqual([]);
  });
});

const SIDEWAYS_OVERFLOW = 'document.documentElement.scrollWidth - document.documentElement.clientWidth';
// A page script as text: the node program has no DOM types.
const CLEAR_SAVED_MAP = "window.localStorage.removeItem('csps-maps')";
const MAP_EMBED = 'https://www.google.com/maps/embed**';
const MAP_STUB =
  '<!doctype html><html lang="en"><head><title>Map stub</title></head><body><p>Map stub</p></body></html>';

test('@contact at 390px the bar shows Messenger and Call us and does not cover the last focusable page element', async ({
  page,
  request,
}) => {
  await withSiteContentLock(async () => {
    await seedDemoSiteContent(request);
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto('/contact');

    const bar = page.locator('[data-contact-bar]');
    await expect(bar.getByRole('link', { name: 'Messenger' })).toHaveAttribute('href', 'https://m.me/cspsdemo');
    await expect(bar.getByRole('link', { name: 'Call us' })).toHaveAttribute('href', 'tel:+639171234567');

    const last = page.getByRole('link', { name: 'Staff Login' });
    await last.focus();
    await expect(last).toBeFocused();
    const lastBox = await last.boundingBox();
    const barBox = await bar.boundingBox();
    expect(lastBox).not.toBeNull();
    expect(barBox).not.toBeNull();
    expect((lastBox?.y ?? 0) + (lastBox?.height ?? 0)).toBeLessThanOrEqual(barBox?.y ?? 0);
    await expectNoAxeViolations(page);
  });
});

test('@contact at 1440px there is no sticky bar', async ({ page, request }) => {
  await withSiteContentLock(async () => {
    await seedDemoSiteContent(request);
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto('/contact');

    await expect(page.getByRole('heading', { level: 2, name: 'Message us' })).toBeVisible();
    await expect(page.getByRole('link', { name: 'Call us' })).toBeHidden();
    await expect(page.getByRole('link', { name: 'Messenger', exact: true })).toBeHidden();
  });
});

test('@contact the map loads from Google only after Show Map, with no CSP report', async ({ page, request }) => {
  await withSiteContentLock(async () => {
    await seedDemoSiteContent(request);
    const googleRequests: string[] = [];
    await page.route(MAP_EMBED, (route) => {
      googleRequests.push(route.request().url());
      return route.fulfill({ contentType: 'text/html', body: MAP_STUB });
    });
    await page.goto('/contact');
    await expect(page.getByRole('button', { name: 'Show Map' })).toBeVisible();
    await expect(page.locator('iframe')).toHaveCount(0);
    expect(googleRequests).toEqual([]);
    await expectNoAxeViolations(page);

    await page.getByRole('button', { name: 'Show Map' }).click();

    const frame = page.locator('iframe[title^="Map of "]');
    await expect(frame).toHaveAttribute('referrerpolicy', 'strict-origin-when-cross-origin');
    await expect(page.frameLocator('iframe').getByText('Map stub')).toBeVisible();
    expect(googleRequests).toHaveLength(1);
    await expect(frame).toBeFocused();
    // Axe cannot enter the cross-origin Google frame (it logs a postMessage warning), so after the tap it checks the label card.
    await expectNoAxeViolations(page, '[data-map-label]');
  });
});

test('@contact a saved Show Map tap loads the map by itself after a reload', async ({ page, request }) => {
  await withSiteContentLock(async () => {
    await seedDemoSiteContent(request);
    await page.route(MAP_EMBED, (route) => route.fulfill({ contentType: 'text/html', body: MAP_STUB }));
    await page.goto('/contact');
    await page.getByRole('button', { name: 'Show Map' }).click();
    await expect(page.frameLocator('iframe').getByText('Map stub')).toBeVisible();

    await page.reload();

    // The frame is in the page at once; it is lazy, so WebKit loads it when the visitor scrolls it near the screen.
    const frame = page.locator('iframe[title^="Map of "]');
    await expect(frame).toHaveCount(1);
    await expect(page.getByRole('button', { name: 'Show Map' })).toHaveCount(0);
    await frame.scrollIntoViewIfNeeded();
    await expect(page.frameLocator('iframe').getByText('Map stub')).toBeVisible();
    await expect(frame).not.toBeFocused();
  });
});

test('@contact clearing the saved map brings back Show Map', async ({ page, request }) => {
  await withSiteContentLock(async () => {
    await seedDemoSiteContent(request);
    await page.route(MAP_EMBED, (route) => route.fulfill({ contentType: 'text/html', body: MAP_STUB }));
    await page.goto('/contact');
    await page.getByRole('button', { name: 'Show Map' }).click();
    await expect(page.frameLocator('iframe').getByText('Map stub')).toBeVisible();

    await page.evaluate(CLEAR_SAVED_MAP);
    await page.reload();

    await expect(page.getByRole('button', { name: 'Show Map' })).toBeVisible();
    await expect(page.locator('iframe')).toHaveCount(0);
    await expectNoAxeViolations(page);
  });
});

test('@contact at 320px the map actions wrap under the address and the page has no sideways scroll', async ({
  page,
  request,
}) => {
  await withSiteContentLock(async () => {
    await seedDemoSiteContent(request);
    await page.setViewportSize({ width: 320, height: 700 });
    await page.goto('/contact');

    const address = page.getByText('12 Sample St., Poblacion, Sample City', { exact: true });
    const directions = page.getByRole('link', { name: /Directions/ });
    await directions.scrollIntoViewIfNeeded();
    const addressBox = await address.boundingBox();
    const directionsBox = await directions.boundingBox();
    expect(directionsBox?.y ?? 0).toBeGreaterThanOrEqual((addressBox?.y ?? 0) + (addressBox?.height ?? 0) - 1);
    // A page script as text: the node program has no DOM types.
    const overflow = await page.evaluate<number>(SIDEWAYS_OVERFLOW);
    expect(overflow).toBeLessThanOrEqual(0);
  });
});

test('@contact-hours the hours card shows the demo week and the status the server gives right now', async ({
  page,
  request,
}) => {
  await withSiteContentLock(async () => {
    await seedDemoSiteContent(request);
    await page.goto('/contact');

    const card = page.locator('[data-hours-card]');
    await expect(card.getByRole('heading', { level: 2, name: 'Business hours' })).toBeVisible();
    await expect(card.getByText('Monday to Saturday', { exact: true })).toBeVisible();
    await expect(card.getByText('9:00 AM - 6:00 PM', { exact: true })).toBeVisible();
    await expect(card.getByText('Sunday', { exact: true })).toBeVisible();
    await expect(card.getByText('Closed', { exact: true })).toBeVisible();

    const answer = await request.get('/api/v1/public/open-status');
    expect(answer.status()).toBe(200);
    const status = (await answer.json()) as { isOpen: boolean };
    await expect(card.getByText(status.isOpen ? 'Open now' : 'Closed now', { exact: true })).toBeVisible();
    await expect(card.getByText(status.isOpen ? 'Closed now' : 'Open now', { exact: true })).toHaveCount(0);
    await expectNoAxeViolations(page);
  });
});

test('@contact-hours the demo closure is listed under Closed on with its date and note, and the call line and footer follow the hours', async ({
  page,
  request,
}) => {
  await withSiteContentLock(async () => {
    await seedDemoSiteContent(request);
    const answer = await request.get(SITE_API);
    expect(answer.status()).toBe(200);
    const site = (await answer.json()) as {
      upcomingClosures: { firstDay: string; lastDay: string; note: string | null }[];
    };
    const closure = site.upcomingClosures.find((item) => item.note === 'Demo holiday');
    expect(closure, 'the seeded demo closure').toBeDefined();
    const [year, month, day] = (closure?.firstDay ?? '').split('-').map(Number);
    const date = new Intl.DateTimeFormat('en-US', {
      timeZone: 'UTC',
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    }).format(new Date(Date.UTC(year ?? 0, (month ?? 1) - 1, day ?? 1)));

    await page.goto('/contact');

    const card = page.locator('[data-hours-card]');
    await expect(card.getByRole('heading', { level: 3, name: 'Closed on' })).toBeVisible();
    await expect(card.getByText(`${date} · Demo holiday`, { exact: true })).toBeVisible();
    await expect(page.getByRole('link', { name: 'Call 0917 123 4567 Mon-Sat, 9:00 AM - 6:00 PM' })).toBeVisible();

    await page.goto('/');
    await expect(page.getByRole('contentinfo').getByText('Mon-Sat · 9:00 AM - 6:00 PM', { exact: true })).toBeVisible();
    await expectNoAxeViolations(page);
  });
});

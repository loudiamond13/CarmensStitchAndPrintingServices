// Global Privacy Control (D-20, ANL-01, ANL-02; UI-SPEC CB1, CS1), in every project. The browser sends Sec-GPC: 1 on every
// request and reports navigator.globalPrivacyControl as true before any page script runs. Such a visitor is never asked
// and never gets a visitor id or the speed reader: Cookie Settings shows the GPC note with Visitor stats locked off and only
// Save Choices, and allowing the Google map still works and keeps stats off.
import type { BrowserContext, Cookie, Page, Request } from '@playwright/test';
import { expect, expectNoAxeViolations, test } from './fixtures.ts';
import { withSiteContentLock } from './site-content-lock.ts';
import { seedDemoSiteContent } from './testing-api.ts';

test.use({ consent: 'none', extraHTTPHeaders: { 'Sec-GPC': '1' } });
// The Contact check waits for the site content lock, which can take 6 minutes.
test.describe.configure({ timeout: 480_000 });

const CONSENT_COOKIE = '__Host-csps_consent';
const VISITOR_COOKIE = '__Secure-csps_vid';
const SPEED_READER = /\/assets\/speedReport-[\w-]+\.js$/;
const MAP_EMBED = 'https://www.google.com/maps/embed**';
const MAP_STUB =
  '<!doctype html><html lang="en"><head><title>Map stub</title></head><body><p>Map stub</p></body></html>';
/** Runs before any page script, in every document of the context. */
const GPC_ON = `Object.defineProperty(navigator, 'globalPrivacyControl', { configurable: true, get: () => true });`;

test.beforeEach(async ({ context }) => {
  await context.addInitScript({ content: GPC_ON });
});

function recordRequests(context: BrowserContext): Request[] {
  const seen: Request[] = [];
  context.on('request', (request) => {
    seen.push(request);
  });
  return seen;
}

const isSpeedReader = (request: Request): boolean => SPEED_READER.test(new URL(request.url()).pathname);

async function cookieNamed(context: BrowserContext, name: string): Promise<Cookie | undefined> {
  return (await context.cookies()).find((cookie) => cookie.name === name);
}

const bar = (page: Page) => page.getByRole('region', { name: 'Cookie choices' });
const settingsWindow = (page: Page) => page.getByRole('dialog', { name: 'Cookie Settings' });

async function openQuietly(page: Page, path: string): Promise<void> {
  await page.goto(path);
  await expect(page.locator('h1')).toBeVisible();
  await page.waitForLoadState('networkidle');
}

test('@gpc a GPC browser sees no cookie bar, gets no cookie and loads no speed reader', async ({ page, context }) => {
  const requests = recordRequests(context);
  await openQuietly(page, '/');
  expect(await page.evaluate<boolean>('navigator.globalPrivacyControl === true')).toBe(true);
  expect(
    requests
      .filter((request) => new URL(request.url()).pathname === '/')
      .map((request) => request.headers()['sec-gpc']),
  ).toEqual(['1']);

  await expect(bar(page)).toHaveCount(0);
  await openQuietly(page, '/products');
  await expect(bar(page)).toHaveCount(0);
  expect(await context.cookies()).toEqual([]);
  expect(requests.filter(isSpeedReader).map((request) => request.url())).toEqual([]);
});

test('@gpc Cookie Settings shows the GPC note with Visitor stats locked off, and allowing the map works with stats kept off', async ({
  page,
  context,
  request,
}) => {
  const requests = recordRequests(context);
  await openQuietly(page, '/');
  await page.getByRole('contentinfo').getByRole('button', { name: 'Cookie Settings' }).click();
  const settings = settingsWindow(page);
  await expect(settings.getByText('Your browser asked us not to track you, so visitor stats stay off.')).toBeVisible();
  const stats = settings.getByRole('checkbox', { name: 'Visitor stats' });
  await expect(stats).toHaveAttribute('aria-disabled', 'true');
  await expect(stats).not.toBeChecked();
  await expect(settings.getByText('Off, because your browser asked us not to track you.')).toBeVisible();
  // A press on the locked box changes nothing.
  await stats.click({ force: true });
  await expect(stats).not.toBeChecked();
  await expect(settings.getByRole('button', { name: 'Reject All' })).toHaveCount(0);
  await expect(settings.getByRole('button', { name: 'Accept All' })).toHaveCount(0);
  await expectNoAxeViolations(page);

  await settings.getByRole('checkbox', { name: 'Google map' }).check();
  const answer = page.waitForResponse(
    (response) => response.url().endsWith('/api/v1/analytics/consent') && response.status() === 200,
  );
  await settings.getByRole('button', { name: 'Save Choices' }).click();
  await answer;
  await expect(settings).toHaveCount(0);
  expect((await cookieNamed(context, CONSENT_COOKIE))?.value).toMatch(/^1_[0-9a-f]{32}_\d+\.\d+_0_1_\d{8}$/);
  expect(await cookieNamed(context, VISITOR_COOKIE)).toBeUndefined();

  await withSiteContentLock(async () => {
    await seedDemoSiteContent(request);
    await context.route(MAP_EMBED, (route) => route.fulfill({ contentType: 'text/html', body: MAP_STUB }));
    await openQuietly(page, '/contact');
    await expect(bar(page)).toHaveCount(0);
    await expect(page.getByRole('button', { name: 'Show Map' })).toHaveCount(0);
    // The frame is loading="lazy", and WebKit loads it only near the window, so it is scrolled to.
    await page.locator('iframe[title^="Map of "]').scrollIntoViewIfNeeded();
    await expect(page.frameLocator('iframe').getByText('Map stub')).toBeVisible();
  });

  await page.getByRole('contentinfo').getByRole('button', { name: 'Cookie Settings' }).click();
  await expect(settingsWindow(page).getByRole('checkbox', { name: 'Google map' })).toBeChecked();
  await expect(settingsWindow(page).getByRole('checkbox', { name: 'Visitor stats' })).not.toBeChecked();
  expect(await cookieNamed(context, VISITOR_COOKIE)).toBeUndefined();
  expect(requests.filter(isSpeedReader).map((request) => request.url())).toEqual([]);
});

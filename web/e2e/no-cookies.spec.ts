// No cookie bar, no cookie and no tracker on the public site (D-54, D-60, ANL-01, ANL-02), in every project. A browser that
// sends Global Privacy Control (Sec-GPC: 1 on every request and navigator.globalPrivacyControl true before any page script runs)
// and a plain browser are treated the same: opening Home and Gallery shows no cookie bar, leaves the cookie jar empty, loads no
// speed reader chunk and makes no request to google.com (the map loads only after a tap). The site still states that it honors GPC.
import type { BrowserContext, Page, Request } from '@playwright/test';
import { expect, test } from './fixtures.ts';

const SPEED_READER = /\/assets\/speedReport-[\w-]+\.js$/;
/** Runs before any page script, in every document of the context. */
const GPC_ON = `Object.defineProperty(navigator, 'globalPrivacyControl', { configurable: true, get: () => true });`;

function recordRequests(context: BrowserContext): Request[] {
  const seen: Request[] = [];
  context.on('request', (request) => {
    seen.push(request);
  });
  return seen;
}

const isSpeedReader = (request: Request): boolean => SPEED_READER.test(new URL(request.url()).pathname);

const isGoogle = (request: Request): boolean => {
  const { hostname } = new URL(request.url());
  return hostname === 'google.com' || hostname.endsWith('.google.com');
};

const bar = (page: Page) => page.getByRole('region', { name: 'Cookie choices' });

async function openQuietly(page: Page, path: string): Promise<void> {
  await page.goto(path);
  await expect(page.locator('h1')).toBeVisible();
  await page.waitForLoadState('networkidle');
}

/** Opens Home and Gallery and checks everything the site must not do: a bar, a Cookie Settings button, a cookie, a speed reader, a Google request. */
async function expectNothingStored(page: Page, context: BrowserContext): Promise<Request[]> {
  const requests = recordRequests(context);
  await openQuietly(page, '/');
  await expect(bar(page)).toHaveCount(0);
  const legal = page.getByRole('contentinfo').getByRole('navigation', { name: 'Legal' });
  await expect(legal.getByRole('link')).toHaveCount(4);
  await expect(legal.getByRole('button')).toHaveCount(0);
  await openQuietly(page, '/gallery');
  await expect(bar(page)).toHaveCount(0);

  expect(await context.cookies()).toEqual([]);
  expect(requests.filter(isSpeedReader).map((request) => request.url())).toEqual([]);
  expect(requests.filter(isGoogle).map((request) => request.url())).toEqual([]);
  return requests;
}

test.describe('a browser that sends GPC', () => {
  test.use({ extraHTTPHeaders: { 'Sec-GPC': '1' } });

  test.beforeEach(async ({ context }) => {
    await context.addInitScript({ content: GPC_ON });
  });

  test('@no-cookies a GPC browser sees no cookie bar, holds no cookie, loads no speed reader and calls no Google', async ({
    page,
    context,
  }) => {
    const requests = await expectNothingStored(page, context);
    expect(await page.evaluate<boolean>('navigator.globalPrivacyControl === true')).toBe(true);
    expect(
      requests
        .filter((request) => new URL(request.url()).pathname === '/')
        .map((request) => request.headers()['sec-gpc']),
    ).toEqual(['1']);
  });
});

test.describe('a plain browser', () => {
  test('@no-cookies a plain browser sees no cookie bar, holds no cookie, loads no speed reader and calls no Google', async ({
    page,
    context,
  }) => {
    const requests = await expectNothingStored(page, context);
    expect(
      requests
        .filter((request) => new URL(request.url()).pathname === '/')
        .map((request) => request.headers()['sec-gpc']),
    ).toEqual([undefined]);
  });
});

test('@no-cookies the site still states that it honors GPC', async ({ request }) => {
  const response = await request.get('/.well-known/gpc.json');
  expect(response.status()).toBe(200);
  expect(((await response.json()) as { gpc: boolean }).gpc).toBe(true);
});

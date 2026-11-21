// No cookie bar, no cookie and no tracker on the public site (D-54, D-60, ANL-01, ANL-02), in every project. A browser that
// sends Global Privacy Control (Sec-GPC: 1 on every request and navigator.globalPrivacyControl true before any page script runs)
// and a plain browser are treated the same: opening Home and Gallery shows no cookie bar, leaves the cookie jar empty, sets no
// cookie from any response, saves nothing in local or session storage, loads no speed reader chunk and makes no request to
// google.com (the map loads only after a tap). The page view beacon is answered. The site still states that it honors GPC.
import type { BrowserContext, Page, Request, Response } from '@playwright/test';
import { expect, test } from './fixtures.ts';

// A cheap extra guard: it matches only a chunk named speedReport. The package check in no-consent.node.test.ts is the real one.
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

const isPageView = (response: Response): boolean => new URL(response.url()).pathname === '/api/v1/analytics/page-views';

/** Records every response of the context, so the Set-Cookie headers of all of them can be checked. */
function recordResponses(context: BrowserContext): Response[] {
  const seen: Response[] = [];
  context.on('response', (response) => {
    seen.push(response);
  });
  return seen;
}

/**
 * Opens Home and Gallery and checks everything the site must not do: a bar, a Cookie Settings button, a cookie, a Set-Cookie header,
 * saved browser storage, a speed reader, a Google request. The page view beacon is waited for, so its answer is checked too.
 */
async function expectNothingStored(page: Page, context: BrowserContext): Promise<Request[]> {
  const requests = recordRequests(context);
  const responses = recordResponses(context);
  const counted = page.waitForResponse(isPageView);
  await openQuietly(page, '/');
  expect((await counted).status(), 'the page view beacon was answered').toBe(204);
  await expect(bar(page)).toHaveCount(0);
  const legal = page.getByRole('contentinfo').getByRole('navigation', { name: 'Legal' });
  await expect(legal.getByRole('link')).toHaveCount(3);
  await expect(legal.getByRole('button')).toHaveCount(0);
  await openQuietly(page, '/gallery');
  await expect(bar(page)).toHaveCount(0);

  expect(await context.cookies()).toEqual([]);
  const setters = await Promise.all(
    responses.map(async (response) =>
      (await response.allHeaders())['set-cookie'] === undefined ? null : response.url(),
    ),
  );
  expect(
    setters.filter((url) => url !== null),
    'no response sets a cookie',
  ).toEqual([]);
  expect(await page.evaluate('({ ...localStorage, ...sessionStorage })'), 'nothing in browser storage').toEqual({});
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

const ORIGIN = 'https://localhost:5199';
const OLD_CONSENT_COOKIE = '__Host-csps_consent';
const OLD_VISITOR_COOKIE = '__Secure-csps_vid';

/** The cookie of that name in the context's jar, whatever its path, or undefined. */
async function cookieNamed(context: BrowserContext, name: string) {
  return (await context.cookies()).find((cookie) => cookie.name === name);
}

// D-63: the server expires the two retired cookies when a browser still sends them. WebKit does not report SameSite on
// read, so the case asserts names only, as @auth-cookies does for the parts it cannot read.
test('@no-cookies a browser holding the old consent and visitor id cookies loses both', async ({ page, context }) => {
  await context.addCookies([
    { name: OLD_CONSENT_COOKIE, value: 'x', url: ORIGIN, secure: true, sameSite: 'Lax' },
    {
      name: OLD_VISITOR_COOKIE,
      value: 'x',
      domain: 'localhost',
      path: '/api/v1/analytics',
      secure: true,
      httpOnly: true,
      sameSite: 'Strict',
    },
  ]);
  expect(await cookieNamed(context, OLD_CONSENT_COOKIE), 'the old consent cookie starts in the jar').toBeDefined();
  expect(await cookieNamed(context, OLD_VISITOR_COOKIE), 'the old visitor id starts in the jar').toBeDefined();

  const counted = page.waitForResponse(
    (response) => new URL(response.url()).pathname === '/api/v1/analytics/page-views',
  );
  await page.goto('/');
  await counted;

  await expect.poll(() => cookieNamed(context, OLD_CONSENT_COOKIE)).toBeUndefined();
  await expect.poll(() => cookieNamed(context, OLD_VISITOR_COOKIE)).toBeUndefined();
});

test('@no-cookies the site still states that it honors GPC', async ({ request }) => {
  const response = await request.get('/.well-known/gpc.json');
  expect(response.status()).toBe(200);
  expect(((await response.json()) as { gpc: boolean }).gpc).toBe(true);
});

// Link previews with JavaScript off (PUB-04, success criterion 2; D-25, D-26, D-42; plan 11-37). A crawler never runs the
// app, so every public URL must carry its own title, description, canonical, Open Graph and Twitter tags, one LocalBusiness
// JSON-LD block without an email, and the data blocks, all from the server's first HTML. The pages are opened in a browser
// context with `javaScriptEnabled: false`; robots.txt, sitemap.xml and the admin header are read with a plain request. A last
// test loads every page with JavaScript on, so the strict CSP and the guard see the JSON-LD and csps-boot blocks (no report).
// Every test seeds the demo shop (share picture included) under the site content lock, because the head reads the shared content.
import type { Browser, BrowserContext, Page } from '@playwright/test';
import { expect, test } from './fixtures.ts';
import { withSiteContentLock } from './site-content-lock.ts';
import { seedDemoSiteContent } from './testing-api.ts';

test.describe.configure({ timeout: 480_000 });

// The demo shop's orders have photo ids with no stored file, so Home and the Gallery draw placeholders after a 404 (declared).
test.beforeEach(({ guard }) => {
  guard.expectStatus('/api/testing/images/', 404);
});

interface PublicUrl {
  readonly path: string;
  readonly title: string;
}

const PAGES: readonly PublicUrl[] = [
  { path: '/', title: 'CSPS · Custom Team Jerseys and Tailoring' },
  { path: '/products', title: 'Products and Prices · CSPS' },
  { path: '/gallery', title: 'Our Work · Gallery · CSPS' },
  { path: '/contact', title: 'Contact Us and Get a Quote · CSPS' },
];

// An email address; a social handle in a link (tiktok.com/@name) is not one and is public.
const EMAIL_LIKE = /[A-Za-z0-9._%+-]+@[A-Za-z0-9-]+\.[A-Za-z]{2,}/;

const SHARE_WIDTH = '1200';
const SHARE_HEIGHT = '630';

/** A new context that never runs a script, on the same host and certificate rules as the project's own. */
async function scriptFreeContext(browser: Browser, baseURL: string | undefined): Promise<BrowserContext> {
  return browser.newContext({ javaScriptEnabled: false, ignoreHTTPSErrors: true, baseURL: baseURL ?? 'https://localhost:5199' });
}

async function metaContent(page: Page, selector: string): Promise<string | null> {
  const found = page.locator(selector);
  return (await found.count()) === 0 ? null : await found.first().getAttribute('content');
}

/** Every key and string value of a parsed JSON value, so a whole document can be searched. */
function walk(value: unknown, keys: string[], texts: string[]): void {
  if (typeof value === 'string') {
    texts.push(value);
  } else if (Array.isArray(value)) {
    for (const item of value) {
      walk(item, keys, texts);
    }
  } else if (typeof value === 'object' && value !== null) {
    for (const [key, inner] of Object.entries(value)) {
      keys.push(key);
      walk(inner, keys, texts);
    }
  }
}

test('@link-preview every public page has its own preview tags and one LocalBusiness block, with JavaScript off', async ({
  browser,
  baseURL,
  request,
}) => {
  await withSiteContentLock(async () => {
    await seedDemoSiteContent(request);
    const origin = new URL(baseURL ?? 'https://localhost:5199').origin;
    const context = await scriptFreeContext(browser, baseURL);
    try {
      const page = await context.newPage();
      const titles: string[] = [];
      const descriptions: string[] = [];
      for (const { path, title } of PAGES) {
        const response = await page.goto(path);
        expect(response?.status(), `${path} status`).toBe(200);

        await expect(page, `${path} title`).toHaveTitle(title);
        const description = await metaContent(page, 'meta[name="description"]');
        expect(description, `${path} description`).toBeTruthy();
        expect(await metaContent(page, 'meta[property="og:title"]'), `${path} og:title`).toBe(title);
        expect(await metaContent(page, 'meta[property="og:description"]'), `${path} og:description`).toBe(description);

        const canonical = await page.locator('link[rel="canonical"]').getAttribute('href');
        expect(canonical, `${path} canonical`).toBe(`${origin}${path}`);
        expect(await metaContent(page, 'meta[property="og:url"]'), `${path} og:url`).toBe(canonical);
        expect(await metaContent(page, 'meta[property="og:type"]'), `${path} og:type`).toBe('website');

        const image = await metaContent(page, 'meta[property="og:image"]');
        expect(image, `${path} og:image`).toMatch(/^https:\/\/\S+$/);
        expect(await metaContent(page, 'meta[property="og:image:width"]'), `${path} og:image:width`).toBe(SHARE_WIDTH);
        expect(await metaContent(page, 'meta[property="og:image:height"]'), `${path} og:image:height`).toBe(SHARE_HEIGHT);
        expect(await metaContent(page, 'meta[name="twitter:card"]'), `${path} twitter:card`).toBe('summary_large_image');
        expect(await metaContent(page, 'meta[name="robots"]'), `${path} is not hidden from search`).toBeNull();

        // One LocalBusiness block, and nothing in it that is, or holds, an email (D-25).
        const blocks = page.locator('script[type="application/ld+json"]');
        await expect(blocks, `${path} JSON-LD blocks`).toHaveCount(1);
        const raw = (await blocks.first().textContent()) ?? '';
        const data: unknown = JSON.parse(raw);
        expect(data, `${path} JSON-LD type`).toMatchObject({ '@type': 'LocalBusiness' });
        const keys: string[] = [];
        const texts: string[] = [];
        walk(data, keys, texts);
        expect(
          keys.filter((key) => /mail/i.test(key)),
          `${path} JSON-LD keys that name an email`,
        ).toEqual([]);
        expect(
          texts.filter((text) => EMAIL_LIKE.test(text)),
          `${path} JSON-LD values that hold an email address`,
        ).toEqual([]);

        // The data block the app reads once instead of asking the API (D-42).
        await expect(page.locator('script#csps-boot'), `${path} boot block`).toHaveCount(1);

        titles.push(title);
        descriptions.push(description ?? '');
      }
      expect(new Set(titles).size, 'every page has its own title').toBe(PAGES.length);
      expect(new Set(descriptions).size, 'every page has its own description').toBe(PAGES.length);
    } finally {
      await context.close();
    }
  });
});

test('@link-preview an unknown path answers 404 with noindex and the 404 title, with JavaScript off', async ({
  browser,
  baseURL,
  guard,
}) => {
  guard.expectStatus('/nope', 404);
  const context = await scriptFreeContext(browser, baseURL);
  try {
    const page = await context.newPage();
    const response = await page.goto('/nope');
    expect(response?.status()).toBe(404);
    await expect(page).toHaveTitle('Page Not Found · CSPS');
    expect(await metaContent(page, 'meta[name="robots"]')).toBe('noindex, nofollow');
    await expect(page.locator('link[rel="canonical"]')).toHaveCount(0);
    await expect(page.locator('script[type="application/ld+json"]')).toHaveCount(0);
  } finally {
    await context.close();
  }
});

test('@link-preview /admin answers with the X-Robots-Tag header and a robots meta tag', async ({ request }) => {
  for (const path of ['/admin', '/admin/orders']) {
    const response = await request.get(path);
    expect(response.status(), `${path} status`).toBe(200);
    expect(response.headers()['x-robots-tag'], `${path} X-Robots-Tag`).toBe('noindex, nofollow');
    expect(await response.text(), `${path} robots meta tag`).toContain('<meta name="robots" content="noindex, nofollow">');
  }
});

test('@link-preview robots.txt names the sitemap and sitemap.xml lists the four pages with the configured origin', async ({
  request,
  baseURL,
}) => {
  const origin = new URL(baseURL ?? 'https://localhost:5199').origin;

  const robots = await request.get('/robots.txt');
  expect(robots.status()).toBe(200);
  const robotsText = await robots.text();
  expect(robotsText).toContain(`Sitemap: ${origin}/sitemap.xml`);
  expect(robotsText).toContain('Disallow: /admin');

  const sitemap = await request.get('/sitemap.xml');
  expect(sitemap.status()).toBe(200);
  const locs = [...(await sitemap.text()).matchAll(/<loc>([^<]+)<\/loc>/g)].map((match) => match[1]);
  expect(locs).toEqual(PAGES.map(({ path }) => `${origin}${path}`));
});

test('@link-preview the JSON-LD and csps-boot blocks of every page raise no CSP report with JavaScript on', async ({
  page,
  request,
  guard,
}) => {
  guard.expectStatus('/nope', 404);
  await withSiteContentLock(async () => {
    await seedDemoSiteContent(request);
    for (const { path } of [...PAGES, { path: '/nope' }]) {
      await page.goto(path);
      await expect(page.locator('h1')).toHaveCount(1);
      await expect(page.locator('script#csps-boot'), `${path} boot block`).toHaveCount(1);
      if (path !== '/nope') {
        await expect(page.locator('script[type="application/ld+json"]'), `${path} JSON-LD`).toHaveCount(1);
      }
      expect((await guard.peek()).cspViolations, `${path} CSP reports`).toEqual([]);
    }
  });
});

// Home page E2E (PUB-01, PUB-02, CONT-03, D-05, D-34, D-36, D-42): the product lines and the testimonials reach a visitor's
// page from the server's own HTML with no extra request. Every test resets the demo shop facts, the six lines and the demo
// testimonials (the Testing seeder) and runs under the site content lock, because they are shared by all five projects.
import { expect, test } from './fixtures.ts';
import { withSiteContentLock } from './site-content-lock.ts';
import { seedDemoSiteContent } from './testing-api.ts';

const HOME_API = '/api/v1/public/home';

// Each test waits its turn for the site content lock, so the 30 second default is not enough (see the site content specs).
test.describe.configure({ timeout: 480_000 });

test('@home / shows six category cards with the seeded card texts, with no home request on the first load', async ({
  page,
  request,
}) => {
  await withSiteContentLock(async () => {
    await seedDemoSiteContent(request);
    const homeRequests: string[] = [];
    page.on('request', (seen) => {
      if (seen.url().includes(HOME_API)) {
        homeRequests.push(seen.url());
      }
    });

    await page.goto('/');

    await expect(page.getByRole('heading', { level: 2, name: 'Pick your kit.' })).toBeVisible();
    const cards = page.getByRole('main').locator('a[href^="/products#"]');
    await expect(cards).toHaveCount(6);
    await expect(cards.first()).toContainText('Basketball Jerseys');
    await expect(cards.first()).toContainText(
      'Full sublimation tops and shorts, any colorway, names and numbers included.',
    );
    await expect(cards.first()).toHaveAttribute('href', '/products#basketball');
    expect(homeRequests).toEqual([]);
  });
});

const SIDEWAYS_OVERFLOW = 'document.documentElement.scrollWidth - document.documentElement.clientWidth';
const FOCUS_RING =
  '(() => { const style = getComputedStyle(document.activeElement); return `${style.outlineStyle} ${parseFloat(style.outlineWidth)}`; })()';
const REGION_OVERFLOW =
  '(() => { const region = document.querySelector(\'[role="region"][aria-label="Testimonials"]\'); return region === null ? -1 : region.scrollWidth - region.clientWidth; })()';

test('@home / shows the demo testimonials in order and the typed turnaround line', async ({ page, request }) => {
  await withSiteContentLock(async () => {
    await seedDemoSiteContent(request);
    await page.goto('/');

    const figures = page.getByRole('main').getByRole('figure');
    await expect(figures).toHaveCount(3);
    await expect(figures.nth(0)).toContainText('Seventeen pieces, names and numbers perfect.');
    await expect(figures.nth(0)).toContainText('Juan Dela Cruz');
    await expect(figures.nth(1)).toContainText('Ana Reyes');
    await expect(figures.nth(2)).toContainText('Ben Santos');
    await expect(
      page.getByRole('main').getByText('Mockups in 24 hours; production starts as soon as the downpayment is in.'),
    ).toBeVisible();
    await expect(page.getByRole('main').getByRole('link', { name: 'Message us on Messenger' })).toHaveAttribute(
      'href',
      'https://m.me/cspsdemo',
    );
  });
});

test('@home at 390px the testimonials are a focusable region with a visible ring and scroll inside themselves', async ({
  page,
  request,
}) => {
  await withSiteContentLock(async () => {
    await seedDemoSiteContent(request);
    await page.setViewportSize({ width: 390, height: 900 });
    await page.goto('/');

    const region = page.getByRole('region', { name: 'Testimonials' });
    await expect(region).toBeAttached();
    await region.scrollIntoViewIfNeeded();
    await region.focus();
    await expect(region).toBeFocused();
    const ring = await page.evaluate<string>(FOCUS_RING);
    expect(ring, 'a visible focus ring on the focused region').toBe('solid 2');
    const inner = await page.evaluate<number>(REGION_OVERFLOW);
    expect(inner, 'the cards are wider than the row, so it scrolls inside itself').toBeGreaterThan(0);
    expect(await page.evaluate<number>(SIDEWAYS_OVERFLOW)).toBeLessThanOrEqual(0);
  });
});

for (const width of [320, 768, 1024, 1280, 1920]) {
  test(`@home at ${String(width)}px the page has no sideways scroll`, async ({ page, request }) => {
    await withSiteContentLock(async () => {
      await seedDemoSiteContent(request);
      await page.setViewportSize({ width, height: 900 });
      await page.goto('/');
      await expect(page.getByRole('heading', { level: 2, name: 'Teams that suit up with us.' })).toBeVisible();

      expect(await page.evaluate<number>(SIDEWAYS_OVERFLOW)).toBeLessThanOrEqual(0);
    });
  });
}

// The number of columns a grid draws: the Why CSPS grid is the third parent of an item title, the testimonial row the parent of a card.
const WHY_COLUMNS =
  "(() => { const title = [...document.querySelectorAll('main h3')].find((h) => h.textContent === 'Team orders'); const grid = title?.parentElement?.parentElement?.parentElement; return grid ? getComputedStyle(grid).gridTemplateColumns.split(' ').length : -1; })()";
const TESTIMONIAL_COLUMNS =
  "(() => { const grid = document.querySelector('main figure')?.parentElement; return grid ? getComputedStyle(grid).gridTemplateColumns.split(' ').length : -1; })()";

for (const [width, why, testimonials] of [
  [1400, 5, 3],
  [1100, 3, 3],
  [900, 3, 2],
] as const) {
  test(`@home at ${String(width)}px Why CSPS has ${String(why)} columns and the testimonials ${String(testimonials)}`, async ({
    page,
    request,
  }) => {
    await withSiteContentLock(async () => {
      await seedDemoSiteContent(request);
      await page.setViewportSize({ width, height: 900 });
      await page.goto('/');
      await expect(page.getByRole('heading', { level: 2, name: 'Teams that suit up with us.' })).toBeVisible();

      expect(await page.evaluate<number>(WHY_COLUMNS)).toBe(why);
      expect(await page.evaluate<number>(TESTIMONIAL_COLUMNS)).toBe(testimonials);
    });
  });
}

test('@home at 390px Why CSPS is one column of rows', async ({ page, request }) => {
  await withSiteContentLock(async () => {
    await seedDemoSiteContent(request);
    await page.setViewportSize({ width: 390, height: 900 });
    await page.goto('/');
    await expect(page.getByRole('heading', { level: 2, name: 'Teams that suit up with us.' })).toBeVisible();

    expect(await page.evaluate<number>(WHY_COLUMNS)).toBe(1);
  });
});

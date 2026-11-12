// Products page E2E (PUB-01, PUB-02, CONT-02, D-04, D-32, D-42): the six product lines reach a visitor's page from the
// server's own HTML with no extra request, with the Manager's price, in every width. Every test resets the demo shop facts
// and the six lines (the Testing seeder) and runs under the site content lock, because the lines are shared by all five
// projects.
import { expect, test } from './fixtures.ts';
import { withSiteContentLock } from './site-content-lock.ts';
import { seedDemoSiteContent } from './testing-api.ts';

const LINES_API = '/api/v1/public/product-lines';

test('@products /products shows six articles and the basketball demo price, with no lines request on the first load', async ({
  page,
  request,
}) => {
  await withSiteContentLock(async () => {
    await seedDemoSiteContent(request);
    const lineRequests: string[] = [];
    page.on('request', (seen) => {
      if (seen.url().includes(LINES_API)) {
        lineRequests.push(seen.url());
      }
    });

    await page.goto('/products');

    await expect(page.getByRole('article')).toHaveCount(6);
    const basketball = page.getByRole('article', { name: 'Basketball Jerseys' });
    await expect(basketball.getByText('Starts at')).toBeVisible();
    await expect(basketball.getByText('₱650.00')).toBeVisible();
    await expect(basketball.getByText('/ pc · min. 10 pcs')).toBeVisible();
    await expect(
      page.getByRole('article', { name: 'Volleyball Jerseys' }).getByText('Message us for a price'),
    ).toBeVisible();
    expect(lineRequests).toEqual([]);
  });
});

const SIDEWAYS_OVERFLOW = 'document.documentElement.scrollWidth - document.documentElement.clientWidth';
const BAR = '[data-products-bar]';

test('@products opening /products#polo lands on the polo article, clear of the header and the pill bar', async ({
  page,
  request,
}) => {
  await withSiteContentLock(async () => {
    await seedDemoSiteContent(request);
    await page.goto('/products#polo');

    const bar = page.locator(BAR);
    const polo = page.locator('article#polo');
    await expect(polo).toBeVisible();
    await expect
      .poll(
        async () => {
          const [barBox, poloBox] = await Promise.all([bar.boundingBox(), polo.boundingBox()]);
          return (poloBox?.y ?? 99999) - ((barBox?.y ?? 0) + (barBox?.height ?? 0));
        },
        { timeout: 15_000 },
      )
      .toBeGreaterThanOrEqual(0);
    const poloBox = await polo.boundingBox();
    expect(poloBox?.y ?? 99999).toBeLessThan(450);
  });
});

test('@products at 320px the pill bar scrolls inside itself, the pills are 44px tall and the page has no sideways scroll', async ({
  page,
  request,
}) => {
  await withSiteContentLock(async () => {
    await seedDemoSiteContent(request);
    await page.setViewportSize({ width: 320, height: 700 });
    await page.goto('/products');

    const nav = page.getByRole('navigation', { name: 'Product lines' });
    await expect(nav.getByRole('link')).toHaveCount(6);
    const inner = await nav.evaluate((element) => element.scrollWidth - element.clientWidth);
    expect(inner, 'the pills are wider than the bar, so it scrolls inside itself').toBeGreaterThan(0);
    for (const link of await nav.getByRole('link').all()) {
      expect((await link.boundingBox())?.height).toBeGreaterThanOrEqual(44);
    }
    const bar = await page.locator(BAR).boundingBox();
    expect(bar?.height).toBeGreaterThanOrEqual(69);
    expect(await page.evaluate<number>(SIDEWAYS_OVERFLOW)).toBeLessThanOrEqual(0);
  });
});

test('@products a control reached by focus stops clear of the header and the pill bar', async ({ page, request }) => {
  await withSiteContentLock(async () => {
    await seedDemoSiteContent(request);
    await page.setViewportSize({ width: 1280, height: 720 });
    await page.goto('/products');
    await expect(page.getByRole('article')).toHaveCount(6);

    const barBottom = async () => {
      const box = await page.locator(BAR).boundingBox();
      return (box?.y ?? 0) + (box?.height ?? 0);
    };
    for (const link of await page.getByRole('main').getByRole('link', { name: 'Get a Quote' }).all()) {
      await link.focus();
      await expect(link).toBeFocused();
      await page.waitForTimeout(150);
      const top = (await link.boundingBox())?.y ?? 0;
      expect(top, 'the focused link is below the sticky bars').toBeGreaterThanOrEqual((await barBottom()) - 1);
    }
  });
});

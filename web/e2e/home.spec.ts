// Home page E2E (PUB-01, PUB-02, CONT-03, D-05, D-34, D-36, D-42): the product lines and the testimonials reach a visitor's
// page from the server's own HTML with no extra request. Every test resets the demo shop facts, the six lines and the demo
// testimonials (the Testing seeder) and runs under the site content lock, because they are shared by all five projects.
import { expect, expectNoAxeViolations, test } from './fixtures.ts';
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

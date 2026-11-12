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

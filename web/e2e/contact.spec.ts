// Contact and footer E2E (PUB-02, PUB-06, D-20, D-42): the shop facts reach a visitor's footer from the server's own HTML
// with no extra request, and Contact lets a visitor message or call the shop. Every test resets the demo shop facts and
// runs under the site content lock, because the singleton settings are shared by all five projects.
import { expect, test } from './fixtures.ts';
import { withSiteContentLock } from './site-content-lock.ts';
import { seedDemoSiteContent } from './testing-api.ts';

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

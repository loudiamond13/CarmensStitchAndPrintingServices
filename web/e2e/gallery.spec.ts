// Gallery page E2E (GAL-01, D-03, D-30 to D-32, WEB-10): the filter bar, the masonry, Show More and the keyboard, against the
// four demo shown orders the Testing seeder puts in the E2E database (two basketball, one volleyball, one moto; the first has four
// photos). Every test resets the demo content and runs under the site content lock, because the gallery is one set shared by
// all five projects. The demo photo ids have no stored file, so each photo address answers 404 and the tile shows its placeholder.
import { expect, test } from './fixtures.ts';
import { withSiteContentLock } from './site-content-lock.ts';
import { seedDemoSiteContent } from './testing-api.ts';

// Each test waits its turn for the site content lock, so the 30 second default is not enough (see the site content specs).
test.describe.configure({ timeout: 480_000 });

const TEST_IMAGES = '/api/testing/images/';

test('@gallery /gallery?category=basketball shows only basketball tiles, the pill count matches them and a reload keeps the filter', async ({
  page,
  request,
  guard,
}) => {
  guard.expectStatus(TEST_IMAGES, 404);
  await withSiteContentLock(async () => {
    await seedDemoSiteContent(request);
    await page.goto('/gallery?category=basketball');

    const tiles = page.getByRole('main').getByRole('button', { name: /^Open / });
    await expect(tiles.first()).toBeVisible();
    const names: string[] = [];
    for (let index = 0; index < (await tiles.count()); index += 1) {
      names.push((await tiles.nth(index).getAttribute('aria-label')) ?? '');
    }
    expect(names).toContain('Open Brgy. Sample Ballers, Basketball');
    expect(names).toContain('Open Tondo Sample Hoopers, Basketball');
    for (const name of names) {
      expect(name).toMatch(/, Basketball$/);
    }

    const toolbar = page.getByRole('toolbar', { name: 'Filter by category' });
    const pill = toolbar.getByRole('button', { name: /^Basketball \d+ items$/ });
    await expect(pill).toHaveAttribute('aria-pressed', 'true');
    const count = Number(/\d+/.exec((await pill.textContent()) ?? '')?.[0]);
    expect(count).toBe(names.length);

    await page.reload();

    await expect(page).toHaveURL(/\?category=basketball$/);
    await expect(toolbar.getByRole('button', { name: /^Basketball \d+ items$/ })).toHaveAttribute(
      'aria-pressed',
      'true',
    );
    await expect(tiles).toHaveCount(names.length);
  });
});

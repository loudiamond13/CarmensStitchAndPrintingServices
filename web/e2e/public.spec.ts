// Public pages E2E (PUB-01, PUB-04, WEB-05, A11Y-01, A11Y-02): the real host serves the SPA for every non-API path (a path
// the site does not know answers a real 404 with the same shell), and each public path shows its page inside the public
// layout in all five projects: the status, one h1 with the approved heading, the document title the server sends (the
// client sets the same one on navigation), one banner, one main and one contentinfo, the skip link first in the keyboard
// order moving focus to main without a hash in the URL, no sideways scroll from 320 to 1920 px, and no console, page, CSP,
// response (the guard) or axe findings.
import { expect, expectNoAxeViolations, test } from './fixtures.ts';

interface PublicPage {
  readonly path: string;
  readonly status: number;
  readonly heading: string;
  readonly title: string;
}

const PAGES: readonly PublicPage[] = [
  { path: '/', status: 200, heading: 'Built for the whole team.', title: 'CSPS · Custom Team Jerseys and Tailoring' },
  { path: '/products', status: 200, heading: 'Every kit, your way.', title: 'Products and Prices · CSPS' },
  { path: '/gallery', status: 200, heading: 'Worn on court & road.', title: 'Our Work · Gallery · CSPS' },
  { path: '/contact', status: 200, heading: "Let's build your kit.", title: 'Contact Us and Get a Quote · CSPS' },
  // A path no page owns: the server answers 404 with the shell, and the client draws the 404 page.
  { path: '/nope', status: 404, heading: 'Out of bounds.', title: 'Page Not Found · CSPS' },
  { path: '/some/deep/path', status: 404, heading: 'Out of bounds.', title: 'Page Not Found · CSPS' },
];

/** The text of the first element in document order that Tab can reach (a page script: the node program has no DOM). */
const FIRST_FOCUSABLE_TEXT = `document.querySelector('a[href], button, input, select, textarea, [tabindex]:not([tabindex="-1"])')?.textContent ?? null`;

for (const { path, status, heading, title } of PAGES) {
  test(`@public ${path} answers ${String(status)} with its page inside the public layout`, async ({
    page,
    browserName,
    guard,
  }) => {
    if (status === 404) {
      guard.expectStatus(path, status);
    }
    const response = await page.goto(path);

    expect(response?.status()).toBe(status);
    await expect(page.locator('h1')).toHaveCount(1);
    await expect(page.locator('h1')).toHaveText(heading);
    await expect(page).toHaveTitle(title);
    await expect(page.getByRole('banner')).toHaveCount(1);
    await expect(page.getByRole('main')).toHaveCount(1);
    await expect(page.getByRole('contentinfo')).toHaveCount(1);

    // A11Y-02: the skip link is the first stop of the keyboard order; it moves focus to main and leaves the URL alone.
    const skip = page.getByRole('link', { name: 'Skip to main content' });
    if (browserName === 'webkit') {
      // WebKit's Tab stops on buttons and form fields only (Safari includes links only with "Press Tab to highlight
      // each item"), so the webkit and iphone projects check that no focusable element comes before the skip link in
      // the document, then focus it directly.
      expect(await page.evaluate(FIRST_FOCUSABLE_TEXT)).toBe('Skip to main content');
      await skip.focus();
    } else {
      await page.keyboard.press('Tab');
    }
    await expect(skip).toBeFocused();
    await page.keyboard.press('Enter');
    await expect(page.locator('main#main')).toBeFocused();
    const url = new URL(page.url());
    expect(url.pathname).toBe(path);
    expect(url.hash).toBe('');

    await expectNoAxeViolations(page);
  });
}

// PUB-04: a client navigation sets the same title the server sends for that page, with no new request for the document.
test('@public a footer link opens Products in the app and sets its title', async ({ page }) => {
  await page.goto('/');
  await expect(page).toHaveTitle(PAGES[0]?.title ?? '');
  await page.getByRole('contentinfo').getByRole('link', { name: 'Products' }).click();

  await expect(page.locator('h1')).toHaveText('Every kit, your way.');
  await expect(page).toHaveTitle('Products and Prices · CSPS');
  expect(new URL(page.url()).pathname).toBe('/products');
});

/** What one page reads about its width and its h1 (read in the page). */
interface Fit {
  readonly pageWidth: number;
  readonly viewport: number;
  readonly h1Left: number;
  readonly h1Right: number;
  readonly h1Overflows: boolean;
}

const READ_FIT = `(() => {
  const h1 = document.querySelector('h1');
  const box = h1.getBoundingClientRect();
  return {
    pageWidth: document.documentElement.scrollWidth,
    viewport: window.innerWidth,
    h1Left: box.left,
    h1Right: box.right,
    h1Overflows: h1.scrollWidth > h1.clientWidth,
  };
})()`;

/** The P2 Playwright widths. */
const WIDTHS = [320, 375, 414, 768, 1024, 1280, 1536, 1920] as const;

// UI layout backstop: no public page shell scrolls sideways from 320 to 1920 px, and the h1 stays inside the window
// (long text: "BUILT FOR THE WHOLE TEAM." wraps at 320 px).
for (const { path, status, heading } of PAGES.slice(0, 5)) {
  test(`@public ${path} has no sideways scroll from 320 to 1920 px and its h1 fits`, async ({ page, guard }) => {
    test.setTimeout(90_000);
    if (status === 404) {
      guard.expectStatus(path, status);
    }
    await page.goto(path);
    await expect(page.locator('h1')).toHaveText(heading);

    for (const width of WIDTHS) {
      await page.setViewportSize({ width, height: 800 });
      const fit = await page.evaluate<Fit>(READ_FIT);
      expect(fit.pageWidth, `${String(width)}px page width`).toBeLessThanOrEqual(fit.viewport);
      expect(fit.h1Left, `${String(width)}px h1 left`).toBeGreaterThanOrEqual(0);
      expect(fit.h1Right, `${String(width)}px h1 right`).toBeLessThanOrEqual(fit.viewport);
      expect(fit.h1Overflows, `${String(width)}px h1 overflow`).toBe(false);
    }
  });
}

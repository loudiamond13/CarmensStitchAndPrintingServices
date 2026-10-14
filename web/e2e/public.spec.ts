// Public layout E2E (WEB-05, A11Y-01, A11Y-02, A11Y-04): the real host serves the SPA for every non-API path, and each
// public path renders the frame on the data router in all five projects: one h1, the matching header link current
// (none on an unknown path), the skip link first in the keyboard order moving focus to main without a hash in the URL,
// and no console, page, CSP, response (the guard) or axe findings.
import { expect, expectNoAxeViolations, test } from './fixtures.ts';

interface PublicPath {
  readonly path: string;
  /** The header link that is current there, or null for none (the catch-all). */
  readonly current: string | null;
}

const PATHS: readonly PublicPath[] = [
  { path: '/', current: 'Home' },
  { path: '/products', current: 'Products' },
  { path: '/some/unknown', current: null },
];

/** The text of the first element in document order that Tab can reach (a page script: the node program has no DOM). */
const FIRST_FOCUSABLE_TEXT = `document.querySelector('a[href], button, input, select, textarea, [tabindex]:not([tabindex="-1"])')?.textContent ?? null`;

for (const { path, current } of PATHS) {
  test(`@public ${path} renders the public frame with ${current ?? 'no'} current link`, async ({
    page,
    browserName,
  }) => {
    const response = await page.goto(path);

    expect(response?.status()).toBe(200);
    await expect(page.locator('h1')).toHaveCount(1);
    await expect(page.locator('h1')).toHaveText('Site update in progress.');
    await expect(page.getByRole('banner')).toHaveCount(1);
    await expect(page.getByRole('main')).toHaveCount(1);
    await expect(page.getByRole('contentinfo')).toHaveCount(1);

    const currentLinks = page.locator('[aria-current="page"]');
    if (current === null) {
      await expect(currentLinks).toHaveCount(0);
    } else {
      await expect(currentLinks).toHaveCount(1);
      await expect(page.locator('nav[aria-label="Main"] a[aria-current="page"]')).toHaveText(current);
    }

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

/** Where the placeholder h1 sits in its wrapper (read in the page). */
interface H1Fit {
  readonly pageWidth: number;
  readonly viewport: number;
  readonly left: number;
  readonly right: number;
  readonly innerLeft: number;
  readonly innerRight: number;
  readonly overflows: boolean;
  readonly lines: number;
  readonly fontSize: string;
}

// Long-text backstop (UI-SPEC "long-text | Public placeholder H1"): at 320px the 52px H1 "SITE UPDATE IN PROGRESS."
// wraps inside its wrapper; nothing is clipped and the page never scrolls sideways.
test('@public at 320px the placeholder h1 wraps inside its wrapper with no horizontal scroll', async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 640 });
  await page.goto('/');
  const heading = page.locator('h1');
  await expect(heading).toHaveText('Site update in progress.');

  const fit = await page.evaluate<H1Fit>(`(() => {
    const h1 = document.querySelector('h1');
    const wrapper = h1.parentElement;
    const box = h1.getBoundingClientRect();
    const frame = wrapper.getBoundingClientRect();
    const style = getComputedStyle(wrapper);
    return {
      pageWidth: document.documentElement.scrollWidth,
      viewport: window.innerWidth,
      left: box.left,
      right: box.right,
      innerLeft: frame.left + parseFloat(style.paddingLeft),
      innerRight: frame.right - parseFloat(style.paddingRight),
      overflows: h1.scrollWidth > h1.clientWidth,
      lines: Math.round(box.height / parseFloat(getComputedStyle(h1).lineHeight)),
      fontSize: getComputedStyle(h1).fontSize,
    };
  })()`);

  expect(fit.fontSize).toBe('52px');
  expect(fit.pageWidth).toBeLessThanOrEqual(fit.viewport);
  expect(fit.left).toBeGreaterThanOrEqual(fit.innerLeft);
  expect(fit.right).toBeLessThanOrEqual(fit.innerRight);
  expect(fit.overflows).toBe(false);
  expect(fit.lines).toBeGreaterThan(1);
});

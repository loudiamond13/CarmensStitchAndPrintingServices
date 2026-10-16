// Holding page E2E (D-17, WEB-05, A11Y-01, A11Y-02): the real host serves the SPA for every non-API path, and each public
// path shows the one standalone holding page in all five projects: one h1 with the approved heading, one main, no
// banner or contentinfo (no site frame), the phone as a tel: link and the Facebook page as an https link, the skip link
// first in the keyboard order moving focus to main without a hash in the URL, and no console, page, CSP, response (the
// guard) or axe findings.
import { expect, expectNoAxeViolations, test } from './fixtures.ts';

const HEADING = 'New website on the way.';

const PATHS: readonly string[] = ['/', '/products', '/gallery', '/contact', '/some/deep/path'];

/** The text of the first element in document order that Tab can reach (a page script: the node program has no DOM). */
const FIRST_FOCUSABLE_TEXT = `document.querySelector('a[href], button, input, select, textarea, [tabindex]:not([tabindex="-1"])')?.textContent ?? null`;

for (const path of PATHS) {
  test(`@public ${path} shows the holding page with the shop facts and no site frame`, async ({
    page,
    browserName,
  }) => {
    const response = await page.goto(path);

    expect(response?.status()).toBe(200);
    await expect(page.locator('h1')).toHaveCount(1);
    await expect(page.locator('h1')).toHaveText(HEADING);
    await expect(page.getByRole('main')).toHaveCount(1);
    await expect(page.getByRole('banner')).toHaveCount(0);
    await expect(page.getByRole('contentinfo')).toHaveCount(0);

    const phone = page.getByRole('link', { name: '0976 287 1938' });
    await expect(phone).toBeVisible();
    await expect(phone).toHaveAttribute('href', 'tel:+639762871938');
    const facebook = page.getByRole('link', { name: 'Facebook page' });
    await expect(facebook).toBeVisible();
    await expect(facebook).toHaveAttribute('href', 'https://www.facebook.com/csptailoring2025');
    await expect(facebook).toHaveAttribute('rel', 'noopener noreferrer');

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

/** Where the holding page h1 sits in its wrapper (read in the page). */
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

// Long-text backstop (UI-SPEC "long-text | Public placeholder H1"): at 320px the 52px H1 "NEW WEBSITE ON THE WAY."
// wraps inside its wrapper; nothing is clipped and the page never scrolls sideways.
test('@public at 320px the holding page h1 wraps inside its wrapper with no horizontal scroll', async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 640 });
  await page.goto('/');
  const heading = page.locator('h1');
  await expect(heading).toHaveText(HEADING);

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

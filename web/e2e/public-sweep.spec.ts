// Phase 11 public sweep (PUB-01, A11Y-01, WCAG 2.2 AA, strict CSP; D-13, D-25; plan 11-37), in all five projects. Each public page
// (Home, Products, Gallery, Contact, the three legal pages, LEGAL-05, D-72) and the 404 page is opened with the demo
// shop in place and checked at the eight P2 widths (320 to 1920 px): no sideways scroll, one h1 and zero axe findings (target-size
// and scrollable-region-focusable are in the rule set). The guard fails every test on a console, page or CSP finding or an
// undeclared failed response. The rendered page holds no "@" in its text, no email in its markup and none of the demo customer's
// private values (D-13, D-25). A legal page shows only the shop's own email as a mailto link (12 D-29), may show the DRAFT notice,
// and has the base footer with the Legal row. A Tab walk through Products, Gallery
// and Contact at 390 and 1440 px proves a focused control is never under the header, a sticky bar or the Contact bar. The pages
// read the shared site content, so each test seeds the demo shop under the site content lock.
import type { Page } from '@playwright/test';
import { expect, expectNoAxeViolations, test } from './fixtures.ts';
import { NO_SIDEWAYS_SCROLL } from './helpers.ts';
import { withSiteContentLock } from './site-content-lock.ts';
import { settle } from './sweep.ts';
import { seedDemoSiteContent } from './testing-api.ts';

// Each test waits its turn for the site content lock, so the 30 second default is not enough (see the site content specs).
test.describe.configure({ timeout: 480_000 });

/** The P2 Playwright widths. */
const WIDTHS = [320, 375, 414, 768, 1024, 1280, 1536, 1920] as const;

interface SweepPage {
  readonly name: string;
  readonly path: string;
  readonly h1: string;
  readonly status: number;
  /** Waits for the part of the page that arrives after the first paint, so the checks see the whole page. */
  readonly ready: (page: Page) => Promise<void>;
  /** A legal page: it shows the shop's own email (12 D-29) and has the base footer. */
  readonly legal?: true;
}

async function settled(page: Page): Promise<void> {
  await page.evaluate('document.fonts.ready.then(() => true)');
  await page.waitForLoadState('networkidle');
  await settle(page);
}

/** The shop's public email in the demo seed (TestingSiteContentSeeder). Only the legal pages show it. */
const SHOP_EMAIL = 'demo-shop@csps.test';

/** A legal page is whole once its contact lines have come from the site settings. */
async function legalReady(page: Page): Promise<void> {
  await expect(page.locator(`a[href="mailto:${SHOP_EMAIL}"]`).first()).toBeVisible();
  await settled(page);
}

const PAGES: readonly SweepPage[] = [
  {
    name: 'Home',
    path: '/',
    h1: 'Built for the whole team.',
    status: 200,
    ready: async (page) => {
      await expect(page.getByRole('heading', { level: 2, name: 'Recent work.' })).toBeVisible();
      await expect(page.getByRole('heading', { level: 2, name: 'Teams that suit up with us.' })).toBeVisible();
      await settled(page);
    },
  },
  {
    name: 'Products',
    path: '/products',
    h1: 'Every kit, your way.',
    status: 200,
    ready: async (page) => {
      await expect(page.getByRole('article')).toHaveCount(6);
      await settled(page);
    },
  },
  {
    name: 'Gallery',
    path: '/gallery',
    h1: 'Worn on court & road.',
    status: 200,
    ready: async (page) => {
      await expect(
        page
          .getByRole('main')
          .getByRole('button', { name: /^Open / })
          .first(),
      ).toBeVisible();
      await settled(page);
    },
  },
  {
    name: 'Contact',
    path: '/contact',
    h1: "Let's build your kit.",
    status: 200,
    ready: settled,
  },
  { name: 'Privacy Policy', path: '/privacy', h1: 'Privacy policy.', status: 200, ready: legalReady, legal: true },
  { name: 'Terms of Use', path: '/terms', h1: 'Terms of use.', status: 200, ready: legalReady, legal: true },
  {
    name: 'Accessibility Statement',
    path: '/accessibility',
    h1: 'Accessibility statement.',
    status: 200,
    ready: legalReady,
    legal: true,
  },
  {
    name: '404',
    path: '/nope',
    h1: 'Out of bounds.',
    status: 404,
    ready: settled,
  },
];

test('@public-sweep the old Cookie Policy address shows Page not found', async ({ page, request, guard }) => {
  guard.expectStatus('/cookies', 404);
  await withSiteContentLock(async () => {
    await seedDemoSiteContent(request);
    const response = await page.goto('/cookies');
    expect(response?.status()).toBe(404);
    await expect(page.locator('h1')).toHaveText('Out of bounds.');
    await expect(page).toHaveTitle('Page Not Found · CSPS');
    await settled(page);
    const legal = page.getByRole('contentinfo').getByRole('navigation', { name: 'Legal' });
    await expect(legal.getByRole('link')).toHaveText(['Privacy Policy', 'Terms of Use', 'Accessibility Statement']);
  });
});

/** The text and markup the demo customer's private values would show up in. */
const EMAIL_IN_MARKUP = /[A-Za-z0-9._%+-]+@[A-Za-z0-9-]+\.[A-Za-z]{2,}/;
/** The seeded customer values all carry this marker (TestingSiteContentSeeder.PrivateMarker); the phone is the demo customer's. */
const PRIVATE_VALUES = ['PRIVATE-DEMO', 'private-demo', '0917 999 0002'] as const;
/** The demo tagline: only the full footer shows it. */
const DEMO_TAGLINE = 'Custom tailoring and full-sublimation printing for teams, leagues and riding groups.';

async function axeProblem(page: Page): Promise<string | null> {
  try {
    await expectNoAxeViolations(page);
    return null;
  } catch (error) {
    return error instanceof Error ? error.message : String(error);
  }
}

for (const sweepPage of PAGES) {
  test(`@public-sweep ${sweepPage.name} has one h1, no sideways scroll and no axe finding from 320 to 1920 px, and shows nothing private`, async ({
    page,
    request,
    guard,
  }) => {
    if (sweepPage.status === 404) {
      guard.expectStatus(sweepPage.path, 404);
    }
    await withSiteContentLock(async () => {
      await seedDemoSiteContent(request);
      const response = await page.goto(sweepPage.path);
      expect(response?.status()).toBe(sweepPage.status);
      await expect(page.locator('h1')).toHaveText(sweepPage.h1);
      await sweepPage.ready(page);

      // D-25 and D-13: no "@" in what a visitor reads, no email in the markup (the data blocks included), none of the private values.
      // A legal page shows the shop's own email and its mailto link, and no other (12 D-29).
      const withoutShopEmail = (text: string): string =>
        sweepPage.legal === true ? text.replaceAll(`mailto:${SHOP_EMAIL}`, '').replaceAll(SHOP_EMAIL, '') : text;
      expect(withoutShopEmail(await page.locator('body').innerText()), 'the visible text has no @').not.toContain('@');
      const markup = await page.content();
      expect(
        EMAIL_IN_MARKUP.exec(withoutShopEmail(markup))?.[0] ?? null,
        'the markup holds no email address',
      ).toBeNull();
      expect(withoutShopEmail(markup), 'the markup has no mailto link').not.toContain('mailto:');
      if (sweepPage.legal === true) {
        const footer = page.getByRole('contentinfo');
        await expect(footer.getByRole('navigation', { name: 'Legal' })).toBeVisible();
        await expect(footer.getByText(DEMO_TAGLINE), 'the base footer has no tagline column').toHaveCount(0);
      }
      for (const value of PRIVATE_VALUES) {
        expect(markup, `the markup has none of the private value ${value}`).not.toContain(value);
      }

      const failures: string[] = [];
      for (const width of WIDTHS) {
        await page.setViewportSize({ width, height: 900 });
        await settle(page);
        const label = `${String(width)}px`;
        if ((await page.locator('h1').count()) !== 1) {
          failures.push(`${label}: the page does not have exactly one h1`);
        }
        if (!(await page.evaluate<boolean>(NO_SIDEWAYS_SCROLL))) {
          failures.push(`${label}: the page scrolls sideways`);
        }
        const axe = await axeProblem(page);
        if (axe !== null) {
          failures.push(`${label}: ${axe}`);
        }
      }
      expect(failures).toEqual([]);
    });
  });
}

/** What the focused element is, and how much of it a bar or the window edge leaves visible (read once scrolling has settled). */
interface FocusReport {
  readonly label: string;
  readonly top: number;
  readonly bottom: number;
  readonly left: number;
  readonly right: number;
  readonly height: number;
  readonly innerHeight: number;
  readonly innerWidth: number;
  readonly isBody: boolean;
  /** Focus came back to a control the walk already visited: the walk went once round the page. */
  readonly revisit: boolean;
  /** The bars that are the topmost thing at a probe point of the control's box. */
  readonly obscuredBy: readonly string[];
  /** How many of the five probe points of the box are in the window and not under a bar. */
  readonly visibleProbes: number;
  readonly probes: number;
}

const READ_FOCUS = `(async () => {
  const sample = () => {
    const rect = document.activeElement.getBoundingClientRect();
    return [window.scrollX, window.scrollY, rect.top, rect.left];
  };
  let last = sample();
  let stable = 0;
  const start = performance.now();
  while (stable < 6 && performance.now() - start < 3000) {
    await new Promise((resolve) => setTimeout(resolve, 50));
    const now = sample();
    stable = now.every((value, index) => value === last[index]) ? stable + 1 : 0;
    last = now;
  }
  const element = document.activeElement;
  const revisit = element.hasAttribute('data-e2e-walked');
  element.setAttribute('data-e2e-walked', '');
  const box = element.getBoundingClientRect();
  const named = element.getAttribute('aria-label');
  const label = named !== null ? named : ((element.textContent || '').trim().slice(0, 40) || element.tagName);
  // A bar covers the control when it is the topmost thing at a point of the control's box that lies in the window.
  const bars = [['header', 'header'], ['pill bar', '[data-products-bar]'], ['filter bar', '[data-gallery-bar]'], ['contact bar', '[data-contact-bar]']];
  const x = (Math.max(box.left, 0) + Math.min(box.right, window.innerWidth)) / 2;
  const probes = box.height > 0 && box.width > 0
    ? [box.top + 2, box.top + box.height * 0.25, box.top + box.height / 2, box.top + box.height * 0.75, box.bottom - 2].map((y) => [x, y])
    : [];
  const inWindow = ([px, py]) => px >= 0 && py >= 0 && px < window.innerWidth && py < window.innerHeight;
  const obscuredBy = [];
  let visibleProbes = 0;
  for (const probe of probes) {
    const found = inWindow(probe) ? document.elementFromPoint(probe[0], probe[1]) : null;
    const covering = found === null ? undefined : bars.find(([, selector]) => [...document.querySelectorAll(selector)].some((bar) => !bar.contains(element) && bar.contains(found) && !element.contains(found)));
    if (found !== null && covering === undefined) visibleProbes += 1;
    if (covering !== undefined && !obscuredBy.includes(covering[0])) obscuredBy.push(covering[0]);
  }
  return {
    label,
    top: box.top,
    bottom: box.bottom,
    left: box.left,
    right: box.right,
    height: box.height,
    innerHeight: window.innerHeight,
    innerWidth: window.innerWidth,
    isBody: element === document.body || element === document.documentElement,
    revisit,
    obscuredBy,
    visibleProbes,
    probes: probes.length,
  };
})()`;

/** WebKit's Tab skips links, so there the next tabbable element in document order is focused directly. */
const FOCUS_NEXT = `(() => {
  const all = [...document.querySelectorAll('a[href], button, input, select, textarea, summary, [tabindex]:not([tabindex="-1"])')]
    .filter((element) => !element.disabled && element.tabIndex >= 0 && element.getClientRects().length > 0 && getComputedStyle(element).visibility !== 'hidden');
  const next = all[all.indexOf(document.activeElement) + 1];
  if (next === undefined) return false;
  next.focus();
  return true;
})()`;

const WALK_STEP_LIMIT = 160;

/** Moves focus one stop forward; false when there is no next stop. */
async function focusForward(page: Page, browserName: string): Promise<boolean> {
  if (browserName === 'webkit') {
    return page.evaluate<boolean>(FOCUS_NEXT);
  }
  await page.keyboard.press('Tab');
  return true;
}

const WALKED_PAGES = PAGES.filter((sweepPage) => ['Products', 'Gallery', 'Contact'].includes(sweepPage.name));

for (const sweepPage of WALKED_PAGES) {
  for (const width of [390, 1440]) {
    test(`@public-sweep ${sweepPage.name} at ${String(width)} px: tabbing through the page never leaves a focused control under a bar`, async ({
      page,
      browserName,
      request,
    }) => {
      await withSiteContentLock(async () => {
        await seedDemoSiteContent(request);
        await page.setViewportSize({ width, height: width === 390 ? 844 : 900 });
        await page.goto(sweepPage.path);
        await expect(page.locator('h1')).toHaveText(sweepPage.h1);
        await sweepPage.ready(page);
        await page.evaluate('window.scrollTo(0, 0)');
        await page.evaluate('document.activeElement instanceof HTMLElement && document.activeElement.blur()');

        // Every engine must keep each focused control from being entirely hidden (WCAG 2.2 SC 2.4.11). Chromium and WebKit scroll a control that
        // is only partly in view, so there the whole box must be clear of every bar and inside the window (D-70 to D-72). Firefox scrolls a
        // focused control only when none of it is in view, so a control it leaves partly under a bar is recorded, not failed.
        const wholeBox = browserName !== 'firefox';
        const problems: string[] = [];
        const recorded: string[] = [];
        let steps = 0;
        for (; steps < WALK_STEP_LIMIT; steps += 1) {
          if (!(await focusForward(page, browserName))) {
            break;
          }
          const focus = await page.evaluate<FocusReport>(READ_FOCUS);
          if (focus.isBody || focus.revisit) {
            break;
          }
          const where = `${focus.label} (step ${String(steps + 1)}, top ${String(Math.round(focus.top))}, bottom ${String(Math.round(focus.bottom))}, left ${String(Math.round(focus.left))}, right ${String(Math.round(focus.right))}, window ${String(focus.innerWidth)} x ${String(focus.innerHeight)})`;
          const outside =
            focus.height > 0 &&
            focus.height < focus.innerHeight &&
            (focus.top < -1 || focus.bottom > focus.innerHeight + 1);
          if (focus.probes > 0 && focus.visibleProbes === 0) {
            problems.push(
              `${where} is entirely hidden${focus.obscuredBy.length > 0 ? ` under the ${focus.obscuredBy.join(' and the ')}` : ''}`,
            );
          } else if (focus.obscuredBy.length > 0 || outside) {
            const line = `${where} is ${focus.obscuredBy.length > 0 ? `partly under the ${focus.obscuredBy.join(' and the ')}` : 'partly outside the window'}`;
            (wholeBox ? problems : recorded).push(line);
          }
        }
        for (const line of recorded) {
          test.info().annotations.push({ type: 'firefox-partly-covered', description: line });
        }
        expect(problems, 'no focused control is hidden or left under a bar').toEqual([]);
        expect(steps, 'the walk reached the controls of the page').toBeGreaterThan(5);
        expect(steps, 'the walk ended at the end of the page, not at the step limit').toBeLessThan(WALK_STEP_LIMIT);
      });
    });
  }
}

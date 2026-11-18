// Focus is never hidden under the cookie bar (WCAG 2.2 SC 2.4.11; UI-SPEC CB1 and Interaction Contract "Focus not obscured"), in
// every project. With no saved choice the bar shows, and the page gets a bottom scroll padding of --spacing-consent-bar.
//   - A Tab walk through Home, Gallery and Contact at 390 and 1440 px: each focused control outside the bar ends above the
//     bar's top edge and is never under the header or a sticky bar. Firefox scrolls a focused control only when none of it is
//     in view, so there a control left partly under a bar is recorded in the annotations, not failed (as in public-sweep).
//   - At 320, 390, 820 and 1440 px the real bar sits on the bottom edge and is no taller than --spacing-consent-bar.
// The pages read the shared site content, so each walk seeds the demo shop under the site content lock.
import type { Page } from '@playwright/test';
import { expect, test } from './fixtures.ts';
import { withSiteContentLock } from './site-content-lock.ts';
import { settle } from './sweep.ts';
import { seedDemoSiteContent } from './testing-api.ts';

test.use({ consent: 'none' });
test.describe.configure({ timeout: 480_000 });

async function settled(page: Page): Promise<void> {
  await page.evaluate('document.fonts.ready.then(() => true)');
  await page.waitForLoadState('networkidle');
  await settle(page);
}

interface WalkedPage {
  readonly name: string;
  readonly path: string;
  readonly h1: string;
  readonly ready: (page: Page) => Promise<void>;
}

const PAGES: readonly WalkedPage[] = [
  {
    name: 'Home',
    path: '/',
    h1: 'Built for the whole team.',
    ready: async (page) => {
      await expect(page.getByRole('heading', { level: 2, name: 'Recent work.' })).toBeVisible();
      await settled(page);
    },
  },
  {
    name: 'Gallery',
    path: '/gallery',
    h1: 'Worn on court & road.',
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
  { name: 'Contact', path: '/contact', h1: "Let's build your kit.", ready: settled },
];

/** The focused control, where the cookie bar starts, and which bars cover the control (read once scrolling has settled). */
interface FocusReport {
  readonly label: string;
  readonly top: number;
  readonly bottom: number;
  readonly height: number;
  readonly innerHeight: number;
  readonly isBody: boolean;
  readonly revisit: boolean;
  readonly inConsentBar: boolean;
  /** The cookie bar's top edge, or null when it is not shown. */
  readonly consentTop: number | null;
  readonly obscuredBy: readonly string[];
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
  const consent = document.querySelector('[data-consent-bar]');
  const bars = [['header', 'header'], ['pill bar', '[data-products-bar]'], ['filter bar', '[data-gallery-bar]'], ['contact bar', '[data-contact-bar]'], ['cookie bar', '[data-consent-bar]']];
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
    height: box.height,
    innerHeight: window.innerHeight,
    isBody: element === document.body || element === document.documentElement,
    revisit,
    inConsentBar: consent !== null && consent.contains(element),
    consentTop: consent === null ? null : consent.getBoundingClientRect().top,
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

async function focusForward(page: Page, browserName: string): Promise<boolean> {
  if (browserName === 'webkit') {
    return page.evaluate<boolean>(FOCUS_NEXT);
  }
  await page.keyboard.press('Tab');
  return true;
}

const bar = (page: Page) => page.getByRole('region', { name: 'Cookie choices' });

for (const walked of PAGES) {
  for (const width of [390, 1440]) {
    test(`@consent ${walked.name} at ${String(width)} px with the cookie bar showing: every focused control stops clear of the bar`, async ({
      page,
      browserName,
      request,
    }) => {
      await withSiteContentLock(async () => {
        await seedDemoSiteContent(request);
        await page.setViewportSize({ width, height: width === 390 ? 844 : 900 });
        await page.goto(walked.path);
        await expect(page.locator('h1')).toHaveText(walked.h1);
        await walked.ready(page);
        await expect(bar(page)).toBeVisible();
        await page.evaluate('window.scrollTo(0, 0)');
        await page.evaluate('document.activeElement instanceof HTMLElement && document.activeElement.blur()');

        const wholeBox = browserName !== 'firefox';
        const problems: string[] = [];
        const recorded: string[] = [];
        let pageStops = 0;
        let steps = 0;
        for (; steps < WALK_STEP_LIMIT; steps += 1) {
          if (!(await focusForward(page, browserName))) {
            break;
          }
          const focus = await page.evaluate<FocusReport>(READ_FOCUS);
          if (focus.isBody || focus.revisit) {
            break;
          }
          if (focus.inConsentBar) {
            continue;
          }
          pageStops += 1;
          const where = `${focus.label} (step ${String(steps + 1)}, top ${String(Math.round(focus.top))}, bottom ${String(Math.round(focus.bottom))}, bar top ${String(Math.round(focus.consentTop ?? -1))})`;
          if (focus.probes > 0 && focus.visibleProbes === 0) {
            problems.push(
              `${where} is entirely hidden${focus.obscuredBy.length > 0 ? ` under the ${focus.obscuredBy.join(' and the ')}` : ''}`,
            );
            continue;
          }
          const underBar =
            focus.consentTop !== null && focus.height < focus.innerHeight && focus.bottom > focus.consentTop + 1;
          if (focus.obscuredBy.length > 0 || underBar) {
            const line = `${where} is ${focus.obscuredBy.length > 0 ? `partly under the ${focus.obscuredBy.join(' and the ')}` : 'below the top of the cookie bar'}`;
            (wholeBox ? problems : recorded).push(line);
          }
        }
        for (const line of recorded) {
          test.info().annotations.push({ type: 'firefox-partly-covered', description: line });
        }
        expect(problems, 'no focused control is hidden or left under the cookie bar').toEqual([]);
        expect(pageStops, 'the walk reached the controls of the page').toBeGreaterThan(5);
        expect(steps, 'the walk ended at the end of the page, not at the step limit').toBeLessThan(WALK_STEP_LIMIT);
        await expect(bar(page)).toBeVisible();
      });
    });
  }
}

/** The real bar against its height token (read in the page). */
interface BarFit {
  readonly bottom: number;
  readonly height: number;
  readonly token: number;
  readonly innerHeight: number;
}

const READ_BAR = `(() => {
  const rect = document.querySelector('[data-consent-bar]').getBoundingClientRect();
  return {
    bottom: rect.bottom,
    height: rect.height,
    token: parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--spacing-consent-bar')),
    innerHeight: window.innerHeight,
  };
})()`;

test('@consent the real cookie bar is no taller than --spacing-consent-bar at 320, 390, 820 and 1440 px', async ({
  page,
}) => {
  await page.goto('/');
  await expect(bar(page)).toBeVisible();
  const failures: string[] = [];
  for (const width of [320, 390, 820, 1440]) {
    await page.setViewportSize({ width, height: 800 });
    await settle(page);
    const fit = await page.evaluate<BarFit>(READ_BAR);
    const expected = width > 767 ? 92 : 204;
    if (fit.token !== expected) {
      failures.push(`${String(width)}px: the token is ${String(fit.token)}, expected ${String(expected)}`);
    }
    if (fit.height > fit.token) {
      failures.push(
        `${String(width)}px: the bar is ${String(fit.height)}px tall, over its ${String(fit.token)}px token`,
      );
    }
    if (Math.abs(fit.bottom - fit.innerHeight) > 1) {
      failures.push(
        `${String(width)}px: the bar ends at ${String(fit.bottom)}, not the bottom edge ${String(fit.innerHeight)}`,
      );
    }
  }
  expect(failures).toEqual([]);
});

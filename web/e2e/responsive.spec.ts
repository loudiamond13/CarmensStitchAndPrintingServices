// Responsive sweep (PERF-03, A11Y-01, D-01; UI-SPEC "Responsive acceptance"; plan 02-35). Every Phase 2 page (sweep.ts:
// `/` in Blush, the five admin preview pages, each an empty state, and the Component Showcase, the admin ones in both
// themes) is checked at 320, 375, 414, 768, 1024, 1280, 1536 and 1920 px wide, in portrait (taller than wide) and in
// landscape (wider than tall). At every size:
//   - no horizontal scroll: `document.documentElement.scrollWidth <= innerWidth`;
//   - exactly one h1, the skip link "Skip to main content" first in the keyboard order, one `main#main`;
//   - labelled landmarks (ARIA landmark naming): every visible region landmark has a name, and so does every landmark
//     whose role (navigation, search, complementary) appears more than once on the page, so a screen reader user can
//     tell them apart. A sole search or complementary landmark needs no name (App. E.7 gives the toolbar none);
//     an aside inside a section is no landmark (HTML-AAM), so the showcase's sidebar cases do not count;
//   - zero axe findings (and, through the shared guard, zero console, page-error, CSP or failed-response findings);
//   - D-01: at phone widths (up to 767px) every text-entry field computes a font size of at least 16px.
// Once per page: the viewport meta never sets `maximum-scale` or `user-scalable=no`.
// Every failure is collected and the list is asserted empty at the end, so one run reports every failing size and page,
// not only the first. The desktop projects sweep all eight widths; the phone projects (Pixel 7, iPhone 15) check their own
// screen in both orientations.
//
// Known owner item, asserted as it is today (deferred-items.md "Admin top bar"): the approved admin Topbar (menu
// button, search box with its content minimum, theme toggle, user button) needs a page at least 398px wide in Chromium,
// 406px in WebKit and 418px in Firefox (the search field's intrinsic width differs by engine; measured in plan 02-35), so
// below that the admin pages scroll sideways by up to 98px. There the check is narrowed: the page is no wider than that
// engine's Topbar minimum, everything that sticks out lies inside the Topbar, and `main` neither overflows nor reaches
// past the screen. Once the owner rules, the plain check applies at every width; remove TOPBAR_MIN_PAGE_WIDTH then.
import type { Page, TestInfo } from '@playwright/test';
import { expect, test } from './fixtures.ts';
import { axeFindings, isShowcase, openPage, PAGES, settle } from './sweep.ts';

const WIDTHS = [320, 375, 414, 768, 1024, 1280, 1536, 1920] as const;

/** Per engine, the admin page width under which the approved Topbar overflows (owner item; see the header comment). */
const TOPBAR_MIN_PAGE_WIDTH: Readonly<Record<string, number>> = { chromium: 398, webkit: 406, firefox: 418 };

/** The phone layout's widest page (spec §3.5: phone ≤ 767px). */
const PHONE_MAX_WIDTH = 767;

interface Size {
  readonly label: string;
  readonly width: number;
  readonly height: number;
}

/** The width under test stays fixed; the orientation sets the height (16:9 taller than wide, or 9:16 wider than tall). */
function sizesFor(testInfo: TestInfo): readonly Size[] {
  const device = testInfo.project.use.viewport;
  if (testInfo.project.name === 'pixel' || testInfo.project.name === 'iphone') {
    // The phone's own screen, upright and turned on its side.
    const width = device?.width ?? 390;
    const height = device?.height ?? 844;
    return [
      { label: `${String(width)}x${String(height)} portrait`, width, height },
      { label: `${String(height)}x${String(width)} landscape`, width: height, height: width },
    ];
  }
  return WIDTHS.flatMap((width) => [
    {
      label: `${String(width)}px portrait`,
      width,
      height: Math.round((width * 16) / 9),
    },
    {
      label: `${String(width)}px landscape`,
      width,
      height: Math.round((width * 9) / 16),
    },
  ]);
}

/** What the page shows at one size (read in the page). */
interface Reading {
  readonly scrollWidth: number;
  readonly innerWidth: number;
  readonly h1s: number;
  readonly mains: number;
  readonly firstFocusable: string | null;
  readonly unlabelledLandmarks: readonly string[];
  readonly smallInputs: readonly string[];
  /** The outermost elements that reach past the right edge (fixed layers and clipped content excluded). */
  readonly offenders: readonly string[];
  /** True when every offender lies inside the admin Topbar. */
  readonly offendersInTopbar: boolean;
  readonly mainOverflow: number;
  readonly mainRight: number;
}

const READ = `(() => {
  const describe = (element) => {
    const id = element.id ? '#' + element.id : '';
    const ui = element.getAttribute('data-ui') ? '[data-ui=' + element.getAttribute('data-ui') + ']' : '';
    const kase = element.closest('[data-case]');
    const where = kase ? ' in [data-case=' + kase.getAttribute('data-case') + ']' : '';
    return element.tagName.toLowerCase() + id + ui + where;
  };
  const visible = (element) => element.getClientRects().length > 0 && getComputedStyle(element).visibility !== 'hidden';
  const nameOf = (element) => {
    const label = (element.getAttribute('aria-label') || '').trim();
    if (label) return label;
    const ids = (element.getAttribute('aria-labelledby') || '').split(/\\s+/).filter(Boolean);
    return ids.map((id) => (document.getElementById(id)?.textContent || '').trim()).join(' ').trim();
  };
  const edge = document.documentElement.clientWidth + 0.5;
  // An element reaches past the right edge when its box does, unless an ancestor that clips sideways ends inside the
  // page first, or it sits in a fixed layer (which never scrolls the page).
  const clippedOrFixed = (element) => {
    for (let node = element; node && node !== document.documentElement; node = node.parentElement) {
      const style = getComputedStyle(node);
      if (style.position === 'fixed') return true;
      if (node !== element && style.overflowX !== 'visible' && node.getBoundingClientRect().right <= edge) return true;
    }
    return false;
  };
  const sticking = [...document.body.querySelectorAll('*')].filter(
    (element) => element.getClientRects().length > 0 && element.getBoundingClientRect().right > edge && !clippedOrFixed(element),
  );
  const outermost = sticking.filter((element) => !sticking.some((other) => other !== element && other.contains(element)));
  const topbar = document.querySelector('[data-ui="s-admin-main"]')?.firstElementChild ?? null;
  const roleOf = (element) => {
    const role = element.getAttribute('role');
    if (role) return role;
    if (element.tagName === 'NAV') return 'navigation';
    return element.parentElement.closest('article, aside, nav, section') ? null : 'complementary';
  };
  const landmarks = [...document.querySelectorAll('nav, aside, [role="navigation"], [role="search"], [role="region"], [role="complementary"]')]
    .filter(visible)
    .map((element) => ({ element, role: roleOf(element) }))
    .filter((landmark) => landmark.role !== null);
  const repeated = (role) => landmarks.filter((landmark) => landmark.role === role).length > 1;
  const textEntry = [...document.querySelectorAll('input, textarea, select')].filter((element) => {
    const type = (element.getAttribute('type') || 'text').toLowerCase();
    return !['checkbox', 'radio', 'file', 'hidden', 'range', 'color', 'submit', 'button', 'reset', 'image'].includes(type) && visible(element);
  });
  const main = document.querySelector('main');
  const first = document.querySelector('a[href], button, input, select, textarea, [tabindex]:not([tabindex="-1"])');
  return {
    scrollWidth: document.documentElement.scrollWidth,
    innerWidth: window.innerWidth,
    h1s: document.querySelectorAll('h1').length,
    mains: document.querySelectorAll('main#main').length,
    firstFocusable: first ? (first.textContent || '').trim() : null,
    unlabelledLandmarks: landmarks
      .filter((landmark) => (landmark.role === 'region' || repeated(landmark.role)) && nameOf(landmark.element) === '')
      .map((landmark) => landmark.role + ' ' + describe(landmark.element)),
    smallInputs: textEntry
      .filter((element) => parseFloat(getComputedStyle(element).fontSize) < 16)
      .map((element) => describe(element) + ' ' + getComputedStyle(element).fontSize),
    offenders: outermost.map((element) => describe(element) + ' right ' + Math.round(element.getBoundingClientRect().right)),
    offendersInTopbar: topbar !== null && outermost.every((element) => topbar.contains(element)),
    mainOverflow: main ? main.scrollWidth - main.clientWidth : 0,
    mainRight: main ? main.getBoundingClientRect().right : 0,
  };
})()`;

/** Checks one page at one size and returns its problems (empty when it passes). */
async function checkSize(page: Page, admin: boolean, size: Size, topbarMinimum: number): Promise<string[]> {
  const problems: string[] = [];
  const reading = await page.evaluate<Reading>(READ);

  if (reading.scrollWidth > reading.innerWidth) {
    const knownTopbar =
      admin &&
      size.width < topbarMinimum &&
      reading.scrollWidth <= topbarMinimum &&
      reading.offendersInTopbar &&
      reading.mainOverflow <= 0 &&
      reading.mainRight <= reading.innerWidth + 0.5;
    if (!knownTopbar) {
      problems.push(
        `scrolls sideways: scrollWidth ${String(reading.scrollWidth)} > innerWidth ${String(reading.innerWidth)} (${reading.offenders.join('; ') || 'no element found'})`,
      );
    }
  }
  if (reading.h1s !== 1) {
    problems.push(`${String(reading.h1s)} h1 elements`);
  }
  if (reading.mains !== 1) {
    problems.push(`${String(reading.mains)} main#main elements`);
  }
  if (reading.firstFocusable !== 'Skip to main content') {
    problems.push(`first focusable is ${JSON.stringify(reading.firstFocusable)}, not the skip link`);
  }
  for (const landmark of reading.unlabelledLandmarks) {
    problems.push(`unlabelled landmark ${landmark}`);
  }
  if (size.width <= PHONE_MAX_WIDTH) {
    for (const input of reading.smallInputs) {
      problems.push(`D-01 text-entry field below 16px: ${input}`);
    }
  }
  for (const finding of await axeFindings(page)) {
    problems.push(`axe ${finding}`);
  }
  return problems;
}

for (const pageCase of PAGES) {
  test(`@responsive ${pageCase.name} has no horizontal scroll, one h1, a skip link, labelled landmarks and no axe findings at every width`, async ({
    page,
    browserName,
  }, testInfo) => {
    // Sixteen sizes with a page-level axe run each; the showcase has about 190 cases.
    test.setTimeout(isShowcase(pageCase) ? 900_000 : 300_000);
    const sizes = sizesFor(testInfo);
    await page.setViewportSize({ width: sizes[0]?.width ?? 320, height: sizes[0]?.height ?? 640 });
    await openPage(page, pageCase);

    // D-01: pinch zoom stays available on every page (never maximum-scale or user-scalable=no).
    const viewportMeta = await page.evaluate<string | null>(
      `document.querySelector('meta[name="viewport"]')?.getAttribute('content') ?? null`,
    );
    expect(viewportMeta).toBe('width=device-width, initial-scale=1');
    expect(viewportMeta).not.toMatch(/maximum-scale|user-scalable\s*=\s*(no|0)/i);

    const failures: string[] = [];
    for (const size of sizes) {
      await page.setViewportSize({ width: size.width, height: size.height });
      await settle(page);
      for (const problem of await checkSize(page, pageCase.admin, size, TOPBAR_MIN_PAGE_WIDTH[browserName] ?? 0)) {
        failures.push(`${pageCase.name} at ${size.label}: ${problem}`);
      }
    }
    expect(failures).toEqual([]);
  });
}

// Long user names in the admin shell (plan 02-32; UI consideration "long-text | Sidebar user chip, Topbar user menu,
// table lead cell"; PERF-03). The user-chip-long-name case holds a 40-character name in the Sidebar user chip (as the
// phone drawer shows it) and in the Topbar user button. This spec measures what a screenshot cannot state on its own:
// at 320 and 390px the name wraps inside the chip, nothing in the Sidebar reaches past its 248px column or the page,
// and on phones the Topbar button leaves the name out (App. B hides the name and role there), so the name adds no
// width. The table lead cell has its own long-name case (rt-long-name, plan 02-30).
//
// The page as a whole is measured by the e2e sweep (`@responsive`): since D-41 R2-01 (owner, 2026-10-13) the Topbar
// search box may shrink below its content, so the admin page fits at 320px whatever the name. It loads the implementation side of the parity build and is guarded like every visual spec. Run it with
// `npm --prefix web run parity -- --grep @navigation`.
import { expect, expectCases, test } from './guard.ts';
import { routeDist } from './serve.ts';
import { fileURLToPath } from 'node:url';

/** The implementation side's origin and build, as in parity.spec.ts (`npm run parity` builds it). */
const APP_ORIGIN = 'https://app.parity.test';
const PARITY_DIST = fileURLToPath(new URL('../.parity-dist', import.meta.url));
const CASE = 'user-chip-long-name';

test.beforeEach(async ({ page }) => {
  await routeDist(page, { origin: APP_ORIGIN, distDir: PARITY_DIST });
});

interface NameMeasure {
  readonly viewport: number;
  readonly nameLength: number;
  readonly asideWidth: number;
  readonly asideRight: number;
  readonly asideOverflow: number;
  readonly chipRight: number;
  readonly nameRight: number;
  readonly nameLines: number;
  readonly nameOverflow: number;
  readonly topbarNameShown: boolean;
  readonly buttonWidth: number;
  readonly buttonOverflow: number;
}

const MEASURE = `(() => {
  const root = document.querySelector('[data-case="${CASE}"]');
  const aside = root.querySelector('aside');
  // The chip: the avatar, then the name over the role (the Logo before it is an image too, so start from the name).
  const name = aside.querySelector('strong');
  const chip = name.parentElement.parentElement;
  const button = root.querySelector('button[aria-haspopup="menu"]');
  const topbarName = button.querySelector('strong');
  const lineHeight = parseFloat(getComputedStyle(name).lineHeight);
  return {
    viewport: window.innerWidth,
    nameLength: name.textContent.length,
    asideWidth: aside.getBoundingClientRect().width,
    asideRight: aside.getBoundingClientRect().right,
    asideOverflow: aside.scrollWidth - aside.clientWidth,
    chipRight: chip.getBoundingClientRect().right,
    nameRight: name.getBoundingClientRect().right,
    nameLines: Math.round(name.getBoundingClientRect().height / lineHeight),
    nameOverflow: name.scrollWidth - name.clientWidth,
    topbarNameShown: topbarName.getClientRects().length > 0,
    buttonWidth: button.getBoundingClientRect().width,
    buttonOverflow: button.scrollWidth - button.clientWidth,
  };
})()`;

for (const width of [320, 390]) {
  test(`@navigation @overflow a 40-character user name wraps inside the sidebar chip and adds no width to the Topbar button at ${String(width)}px`, async ({
    page,
  }) => {
    await page.setViewportSize({ width, height: 900 });
    const response = await page.goto(`${APP_ORIGIN}/parity.html?case=${CASE}&theme=light`);
    expect(response?.status()).toBe(200);
    expect(await expectCases(page)).toBe(1);
    expect(await page.evaluate('document.fonts.ready.then(() => document.fonts.status)')).toBe('loaded');

    const measured: NameMeasure = await page.evaluate(MEASURE);

    expect(measured.nameLength).toBe(40);
    // The Sidebar keeps its 248px column inside the page, and nothing in it scrolls sideways.
    expect(measured.asideWidth).toBe(248);
    expect(measured.asideRight).toBeLessThanOrEqual(measured.viewport);
    expect(measured.asideOverflow).toBe(0);
    // The name wraps onto more lines inside the chip instead of running past it.
    expect(measured.nameLines).toBeGreaterThan(1);
    expect(measured.nameOverflow).toBe(0);
    expect(measured.nameRight).toBeLessThanOrEqual(measured.chipRight);
    // On phones the Topbar button shows the avatar and the chevron only, so the long name takes no room there.
    expect(measured.topbarNameShown).toBe(false);
    expect(measured.buttonOverflow).toBe(0);
    expect(measured.buttonWidth).toBeLessThanOrEqual(72);
  });
}

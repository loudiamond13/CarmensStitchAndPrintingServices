// The owner's WCAG rulings, checked on computed styles in the real browser (A11Y-04, UI-SPEC Color → owner-ruled rows,
// D-31; plan 02-35), on every Phase 2 page (sweep.ts) in both admin themes and in all five projects:
//   - D-02: no text-bearing element renders below opacity 1. The only allowed fade is a disabled control's (the
//     `disabled:` / `aria-disabled:opacity-45` allow-list); everything else on the D-02 allow-list carries no text.
//   - D-05: no element computes to opacity 0 or visibility hidden while it has keyboard focus, Tabbing through the whole
//     page; the ImageUploader thumb grip and actions are hidden at rest only on devices that hover, appear on keyboard
//     focus within the thumb, and always show on touch.
//   - D-03: current and selected items (site link, sidebar item, tab-bar item, selected tab) are weight 700, their
//     inactive siblings 600.
//   - D-BL-02: the current sidebar row hides its "Manager" tag; on other rows it shows at full opacity (FYI-01).
//   - O-3: the current public drawer link is 800 italic with aria-current="page" (the showcase's opened SiteHeader drawer,
//     because the public route is the standalone holding page, D-17, until the Phase 11 public layout).
//   - O-6: under reduced motion the skeleton shimmer and the modal, slide-over and toast entry animations are none.
// Opacity is read as the effective value (the product of the element's and its ancestors' computed opacity), because a
// faded parent fades its text as much as the text's own opacity would.
import type { Page } from '@playwright/test';
import { expect, test } from './fixtures.ts';
import { isShowcase, openPage, PAGES, settle } from './sweep.ts';

const DESKTOP = { width: 1280, height: 900 } as const;
const PHONE = { width: 390, height: 844 } as const;

/** A page-script helper: the element's effective opacity (its own times every ancestor's). */
const EFFECTIVE_OPACITY = `const effectiveOpacity = (element) => {
  let opacity = 1;
  for (let node = element; node; node = node.parentElement) opacity *= parseFloat(getComputedStyle(node).opacity);
  return opacity;
};
const describe = (element) => {
  const kase = element.closest('[data-case]');
  const text = (element.textContent || element.getAttribute('aria-label') || '').trim().replace(/\\s+/g, ' ').slice(0, 40);
  return element.tagName.toLowerCase() + ' "' + text + '"' + (kase ? ' in [data-case=' + kase.getAttribute('data-case') + ']' : '');
};`;

const READ_FADED_TEXT = `(() => {
  ${EFFECTIVE_OPACITY}
  const ownText = (element) => [...element.childNodes].some((node) => node.nodeType === 3 && node.data.trim() !== '');
  return [...document.body.querySelectorAll('*')]
    .filter((element) => ownText(element) && element.getClientRects().length > 0)
    .filter((element) => !element.closest(':disabled, [aria-disabled="true"]'))
    .filter((element) => effectiveOpacity(element) < 1)
    .map((element) => describe(element) + ' opacity ' + effectiveOpacity(element).toFixed(2));
})()`;

for (const pageCase of PAGES) {
  test(`@a11y-rulings D-02 no text-bearing element on ${pageCase.name} renders below opacity 1`, async ({ page }) => {
    test.setTimeout(isShowcase(pageCase) ? 120_000 : 60_000);
    for (const size of [DESKTOP, PHONE]) {
      await page.setViewportSize(size);
      if (size === DESKTOP) {
        await openPage(page, pageCase);
      }
      await settle(page);
      expect(await page.evaluate<string[]>(READ_FADED_TEXT), `${String(size.width)}px`).toEqual([]);
    }
  });
}

/** What has keyboard focus now, and whether it can be seen. */
interface FocusReading {
  readonly key: string | null;
  readonly description: string;
  readonly opacity: number;
  readonly visibility: string;
}

const READ_FOCUS = `(() => {
  ${EFFECTIVE_OPACITY}
  const element = document.activeElement;
  if (!element || element === document.body) return { key: null, description: 'body', opacity: 1, visibility: 'visible' };
  if (!element.hasAttribute('data-e2e-focus')) element.setAttribute('data-e2e-focus', String(document.querySelectorAll('[data-e2e-focus]').length));
  return {
    key: element.getAttribute('data-e2e-focus'),
    description: describe(element),
    opacity: effectiveOpacity(element),
    visibility: getComputedStyle(element).visibility,
  };
})()`;

/** The number of elements Tab can reach at most (a bound for the walk). */
const COUNT_TABBABLE = `[...document.querySelectorAll('a[href], button, input, select, textarea, [tabindex]')].filter(
  (element) => element.tabIndex >= 0 && !element.disabled,
).length`;

/** Tabs through the whole page from the top and returns every stop where the focused element cannot be seen. */
async function tabThrough(page: Page): Promise<{ stops: number; hidden: string[] }> {
  await page.evaluate(`document.activeElement instanceof HTMLElement && document.activeElement.blur()`);
  const bound = (await page.evaluate<number>(COUNT_TABBABLE)) + 5;
  const hidden: string[] = [];
  const seen = new Set<string>();
  let stops = 0;
  for (let press = 0; press < bound; press += 1) {
    await page.keyboard.press('Tab');
    let focus = await page.evaluate<FocusReading>(READ_FOCUS);
    if (focus.opacity < 1 || focus.visibility === 'hidden') {
      // The approved reveal is a 0.15s opacity transition (App. B `.csp-thumb-actions`), so a faded control is read
      // again once it has run: the check is that focus makes the control visible, not that the fade-in takes no time.
      await settle(page);
      focus = await page.evaluate<FocusReading>(READ_FOCUS);
    }
    if (focus.key === null) {
      continue;
    }
    if (seen.has(focus.key)) {
      // Back at an element visited before: the walk went round the whole page.
      break;
    }
    seen.add(focus.key);
    stops += 1;
    if (focus.opacity <= 0 || focus.visibility === 'hidden') {
      hidden.push(`${focus.description} opacity ${focus.opacity.toFixed(2)} visibility ${focus.visibility}`);
    }
  }
  return { stops, hidden };
}

for (const pageCase of PAGES) {
  test(`@a11y-rulings D-05 no focused element on ${pageCase.name} computes to opacity 0 or visibility hidden while Tabbing`, async ({
    page,
    browserName,
  }) => {
    // The showcase has a few hundred Tab stops; WebKit under a full parallel run takes up to five minutes for them.
    test.setTimeout(isShowcase(pageCase) ? 600_000 : 60_000);
    await page.setViewportSize(DESKTOP);
    await openPage(page, pageCase);

    const { stops, hidden } = await tabThrough(page);
    // WebKit's Tab skips links (Safari's default), so its walk is shorter, but it still reaches every button and field.
    // The D-17 holding page at `/` has links only, so WebKit has no stop there.
    if (!(browserName === 'webkit' && pageCase.path === '/')) {
      expect(stops).toBeGreaterThan(0);
    }
    expect(hidden).toEqual([]);
  });
}

const SHOWCASE_LIGHT = PAGES.find((pageCase) => isShowcase(pageCase) && pageCase.theme === 'light');

function required<T>(value: T | undefined, what: string): T {
  if (value === undefined) {
    throw new Error(`sweep.ts no longer lists ${what}`);
  }
  return value;
}

/** The ImageUploader thumb grip and action groups (the elements D-05 hides at rest on hover devices). */
const READ_REVEALS = `(() => {
  ${EFFECTIVE_OPACITY}
  return [...document.querySelectorAll('[class*="group-focus-within/thumb:opacity-100"]')].map((element) => effectiveOpacity(element));
})()`;

test('@a11y-rulings D-05 the thumb grip and actions show on touch, and on keyboard focus within the thumb elsewhere', async ({
  page,
}, testInfo) => {
  await openPage(page, required(SHOWCASE_LIGHT, '/dev/components'));
  const atRest = await page.evaluate<number[]>(READ_REVEALS);
  expect(atRest.length).toBeGreaterThan(0);

  if (testInfo.project.use.hasTouch === true) {
    // `hover: none`: always visible.
    expect(atRest.every((opacity) => opacity === 1)).toBe(true);
    return;
  }
  // A hover device: hidden at rest, shown while a control inside the thumb has keyboard focus.
  expect(atRest.every((opacity) => opacity === 0)).toBe(true);
  const remove = page
    .locator('[data-case="uploader-with-images"]')
    .getByRole('button', { name: /^Remove / })
    .first();
  await remove.focus();
  await settle(page);
  const focused = await page.evaluate<number[]>(`(() => {
    ${EFFECTIVE_OPACITY}
    const thumb = document.activeElement.closest('li');
    return [...thumb.querySelectorAll('[class*="group-focus-within/thumb:opacity-100"]')].map((element) => effectiveOpacity(element));
  })()`);
  expect(focused.length).toBeGreaterThan(0);
  expect(focused.every((opacity) => opacity === 1)).toBe(true);
});

/** Visible current/selected items and their inactive siblings, with their computed weight and style. */
interface CueReading {
  readonly current: readonly { readonly what: string; readonly weight: string; readonly style: string }[];
  readonly inactive: readonly { readonly what: string; readonly weight: string }[];
}

const READ_CUES = `(() => {
  ${EFFECTIVE_OPACITY}
  const visible = (element) => element.getClientRects().length > 0;
  const outsideDrawer = (element) => !element.closest('nav[aria-label="Mobile"]');
  const current = [
    ...document.querySelectorAll('[aria-current="page"]'),
    ...document.querySelectorAll('[role="tab"][aria-selected="true"]'),
  ].filter((element) => visible(element) && outsideDrawer(element));
  const inactive = [
    ...document.querySelectorAll('nav a:not([aria-current])'),
    ...document.querySelectorAll('[role="tab"][aria-selected="false"]'),
  ].filter((element) => visible(element) && outsideDrawer(element) && element.closest('nav[aria-label="Main"], nav[aria-label="Admin"], [role="tablist"]'));
  const read = (element) => ({ what: describe(element), weight: getComputedStyle(element).fontWeight, style: getComputedStyle(element).fontStyle });
  return { current: current.map(read), inactive: inactive.map(read) };
})()`;

for (const pageCase of PAGES) {
  test(`@a11y-rulings D-03 current and selected items on ${pageCase.name} are weight 700`, async ({ page }) => {
    test.setTimeout(isShowcase(pageCase) ? 120_000 : 60_000);
    const problems: string[] = [];
    let currentSeen = 0;
    for (const size of [DESKTOP, PHONE]) {
      await page.setViewportSize(size);
      if (size === DESKTOP) {
        await openPage(page, pageCase);
      }
      await settle(page);
      const cues = await page.evaluate<CueReading>(READ_CUES);
      currentSeen += cues.current.length;
      for (const item of cues.current) {
        if (item.weight !== '700') {
          problems.push(`${String(size.width)}px current ${item.what} is weight ${item.weight}`);
        }
      }
      for (const item of cues.inactive) {
        if (item.weight !== '600') {
          problems.push(`${String(size.width)}px inactive ${item.what} is weight ${item.weight}`);
        }
      }
    }
    // Every page has a current item somewhere: a sidebar or tab-bar item on the admin pages, and the showcase's
    // navigation and tab cases (its own sidebar marks none current, plan 02-34). The D-17 holding page at `/` has no
    // navigation, so it has none.
    if (pageCase.path !== '/') {
      expect(currentSeen).toBeGreaterThan(0);
    }
    expect(problems).toEqual([]);
  });
}

/** Every visible "Manager" tag in the page's own sidebar, and whether it sits on the current row. */
const READ_MANAGER_TAGS = `(() => {
  ${EFFECTIVE_OPACITY}
  const side = document.querySelector('[data-ui="s-admin-side"]');
  const rows = [...side.querySelectorAll('nav a')];
  return rows.map((row) => {
    const tag = [...row.querySelectorAll('*')].find((element) => element.childElementCount === 0 && element.textContent === 'Manager');
    return {
      row: (row.textContent || '').replace('Manager', '').trim(),
      current: row.getAttribute('aria-current') === 'page',
      tag: tag === undefined ? null : { visible: tag.getClientRects().length > 0, opacity: effectiveOpacity(tag) },
    };
  });
})()`;

interface ManagerRow {
  readonly row: string;
  readonly current: boolean;
  readonly tag: { readonly visible: boolean; readonly opacity: number } | null;
}

for (const pageCase of PAGES.filter((candidate) => candidate.path.startsWith('/admin'))) {
  test(`@a11y-rulings D-BL-02 the current sidebar row on ${pageCase.name} hides the Manager tag`, async ({ page }) => {
    await page.setViewportSize(DESKTOP);
    await openPage(page, pageCase);

    const rows = await page.evaluate<ManagerRow[]>(READ_MANAGER_TAGS);
    const users = rows.find((row) => row.row === 'Users');
    expect(users?.tag, 'the Users row has a Manager tag in the DOM').not.toBeNull();
    if (pageCase.path === '/admin/users') {
      expect(users?.current).toBe(true);
      expect(users?.tag?.visible).toBe(false);
    } else {
      expect(users?.current).toBe(false);
      // FYI-01: the tag on a row that is not current shows at full opacity.
      expect(users?.tag).toEqual({ visible: true, opacity: 1 });
    }
  });
}

interface DrawerLink {
  readonly text: string;
  readonly current: string | null;
  readonly weight: string;
  readonly fontStyle: string;
}

test('@a11y-rulings O-3 the current public drawer link is 800 italic with aria-current="page"', async ({ page }) => {
  await page.setViewportSize(PHONE);
  await openPage(page, required(SHOWCASE_LIGHT, '/dev/components'));
  const drawer = page.locator('[data-case="site-header-drawer-open"]').getByRole('navigation', { name: 'Mobile' });
  await expect(drawer).toBeVisible();

  const links = await page.evaluate<
    DrawerLink[]
  >(`[...document.querySelectorAll('[data-case="site-header-drawer-open"] nav[aria-label="Mobile"] a')].map((element) => ({
    text: (element.textContent || '').trim(),
    current: element.getAttribute('aria-current'),
    weight: getComputedStyle(element).fontWeight,
    fontStyle: getComputedStyle(element).fontStyle,
  }))`);
  const current = links.filter((link) => link.current === 'page');
  expect(current).toEqual([{ text: 'Home', current: 'page', weight: '800', fontStyle: 'italic' }]);
  for (const link of links.filter((candidate) => candidate.current === null)) {
    expect(link.fontStyle, `${link.text} is upright`).toBe('normal');
  }
});

/** The animation names of every element in a layer: the dialog layer (overlay root and below) or the toast layer. */
function readAnimations(selector: string): string {
  return `(() => {
    const roots = [...document.querySelectorAll('${selector}')];
    const names = new Set();
    for (const root of roots) {
      for (const element of [root, ...root.querySelectorAll('*')]) names.add(getComputedStyle(element).animationName);
    }
    return [...names].sort();
  })()`;
}

const ENTRY_ANIMATIONS = ['csp-fade', 'csp-rise', 'csp-slide'];

/** Opens a demo dialog, reads its layer's animation names, then closes it with Esc. */
async function dialogAnimations(page: Page, trigger: string): Promise<string[]> {
  await page.getByRole('button', { name: trigger }).click();
  await expect(page.getByRole('dialog')).toBeVisible();
  const names = await page.evaluate<string[]>(readAnimations('[data-ui="s-overlay"], [role="dialog"]'));
  await page.keyboard.press('Escape');
  await expect(page.getByRole('dialog')).toHaveCount(0);
  return names;
}

/** Raises the success toast, reads the toast layer's animation names, then dismisses it. */
async function toastAnimations(page: Page): Promise<string[]> {
  await page.getByRole('button', { name: 'Show success toast' }).click();
  const layer = page.locator('[data-ui="s-toast-layer"]');
  await expect(layer.getByText('Payment added')).toBeVisible();
  const names = await page.evaluate<string[]>(readAnimations('[data-ui="s-toast-layer"] > *'));
  await layer.getByRole('button', { name: 'Dismiss' }).click();
  await expect(layer.getByText('Payment added')).toHaveCount(0);
  return names;
}

const READ_SKELETONS = `[...document.querySelectorAll('[class*="animate-csp-shimmer"]')].map((element) => getComputedStyle(element).animationName)`;

test('@a11y-rulings O-6 under reduced motion the skeleton, modal, slide-over and toast animations are none', async ({
  page,
}) => {
  test.setTimeout(120_000);
  await page.setViewportSize(DESKTOP);
  await openPage(page, required(SHOWCASE_LIGHT, '/dev/components'));

  // Control: without the preference the same elements do animate, so the reduced-motion readings below can fail.
  await page.emulateMedia({ reducedMotion: 'no-preference' });
  const shimmering = await page.evaluate<string[]>(READ_SKELETONS);
  expect(shimmering.length).toBeGreaterThan(0);
  expect(new Set(shimmering)).toEqual(new Set(['csp-shimmer']));
  expect((await dialogAnimations(page, 'Open Add Payment')).some((name) => ENTRY_ANIMATIONS.includes(name))).toBe(true);
  expect((await dialogAnimations(page, 'Open Add User')).some((name) => ENTRY_ANIMATIONS.includes(name))).toBe(true);
  expect(await toastAnimations(page)).toContain('csp-rise');

  await page.emulateMedia({ reducedMotion: 'reduce' });
  expect(new Set(await page.evaluate<string[]>(READ_SKELETONS))).toEqual(new Set(['none']));
  expect(await dialogAnimations(page, 'Open Add Payment')).toEqual(['none']);
  expect(await dialogAnimations(page, 'Open Add User')).toEqual(['none']);
  expect(await toastAnimations(page)).toEqual(['none']);
});

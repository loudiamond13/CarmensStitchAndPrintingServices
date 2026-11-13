// Gallery page E2E (GAL-01, D-03, D-30 to D-32, WEB-10): the filter bar, the masonry, Show More and the keyboard, against the
// four demo shown orders the Testing seeder puts in the E2E database (two basketball, one volleyball, one moto; the first has four
// photos). Every test resets the demo content and runs under the site content lock, because the gallery is one set shared by
// all five projects. The demo photos are tiny stored files, so their addresses answer 200.
import { expect, expectNoAxeViolations, test } from './fixtures.ts';
import { withSiteContentLock } from './site-content-lock.ts';
import { seedDemoSiteContent } from './testing-api.ts';

// Each test waits its turn for the site content lock, so the 30 second default is not enough (see the site content specs).
test.describe.configure({ timeout: 480_000 });

test('@gallery /gallery?category=basketball shows only basketball tiles, the pill count matches them and a reload keeps the filter', async ({
  page,
  request,
}) => {
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

const SIDEWAYS_OVERFLOW = 'document.documentElement.scrollWidth - document.documentElement.clientWidth';
const BAR_OVERFLOW =
  '(() => { const bar = document.querySelector(\'[role="toolbar"]\'); return bar === null ? -1 : bar.scrollWidth - bar.clientWidth; })()';
// Where the focused element sits against the sticky header and the sticky filter bar, in viewport pixels, read once the scroll has settled.
const FOCUS_AGAINST_BARS =
  "(async () => { let last = -1; let stable = 0; const start = performance.now(); while (stable < 6 && performance.now() - start < 3000) { await new Promise((resolve) => setTimeout(resolve, 50)); stable = window.scrollY === last ? stable + 1 : 0; last = window.scrollY; } const active = document.activeElement; const box = active.getBoundingClientRect(); const header = document.querySelector('header'); const bar = document.querySelector('[data-gallery-bar]'); return { label: active.getAttribute('aria-label'), top: box.top, bottom: box.bottom, windowHeight: window.innerHeight, header: header === null ? 0 : header.getBoundingClientRect().bottom, bar: bar === null ? 0 : bar.getBoundingClientRect().bottom }; })()";

interface FocusAgainstBars {
  readonly label: string | null;
  readonly top: number;
  readonly bottom: number;
  readonly windowHeight: number;
  readonly header: number;
  readonly bar: number;
}

test('@gallery at 320px the pill bar scrolls inside itself and the page has no sideways scroll', async ({
  page,
  request,
}) => {
  await withSiteContentLock(async () => {
    await seedDemoSiteContent(request);
    await page.setViewportSize({ width: 320, height: 800 });
    await page.goto('/gallery');
    await expect(page.getByRole('toolbar', { name: 'Filter by category' })).toBeVisible();
    await expect(
      page
        .getByRole('main')
        .getByRole('button', { name: /^Open / })
        .first(),
    ).toBeVisible();

    expect(await page.evaluate<number>(BAR_OVERFLOW), 'the pills are wider than the bar').toBeGreaterThan(0);
    expect(await page.evaluate<number>(SIDEWAYS_OVERFLOW)).toBeLessThanOrEqual(0);
  });
});

for (const width of [390, 1440]) {
  test(`@gallery at ${String(width)}px a focused tile is never under the header or the filter bar`, async ({
    page,
    request,
    browserName,
  }) => {
    await withSiteContentLock(async () => {
      await seedDemoSiteContent(request);
      await page.setViewportSize({ width, height: 700 });
      await page.goto('/gallery');
      const tiles = page.getByRole('main').getByRole('button', { name: /^Open / });
      await expect(tiles.first()).toBeVisible();
      const count = await tiles.count();

      await tiles.first().focus();
      for (let seen = 0; seen < count; seen += 1) {
        const at = await page.evaluate<FocusAgainstBars>(FOCUS_AGAINST_BARS);
        expect(at.label, 'a tile is focused').toMatch(/^Open /);
        const barsBottom = Math.max(at.header, at.bar);
        if (browserName === 'firefox') {
          // Firefox scrolls a focused control only until part of it shows (P11-BL-46): part of the tile must still be in view.
          expect(at.bottom, `${at.label ?? ''} is not entirely under the header and the bar`).toBeGreaterThan(barsBottom);
          expect(at.top, `${at.label ?? ''} is not entirely below the window`).toBeLessThan(at.windowHeight);
        } else {
          expect(at.top, `${at.label ?? ''} starts below the header and the bar`).toBeGreaterThanOrEqual(barsBottom - 1);
        }
        await page.keyboard.press('Tab');
      }
    });
  });
}

// The guard fixture fails each test on any console, page, CSP or response finding, so these also prove a clean console.
for (const width of [390, 1440]) {
  test(`@gallery at ${String(width)}px there are no axe, console or CSP findings and no sideways scroll`, async ({
    page,
    request,
  }) => {
    await withSiteContentLock(async () => {
      await seedDemoSiteContent(request);
      await page.setViewportSize({ width, height: 900 });
      await page.goto('/gallery');
      await expect(
        page
          .getByRole('main')
          .getByRole('button', { name: /^Open / })
          .first(),
      ).toBeVisible();

      expect(await page.evaluate<number>(SIDEWAYS_OVERFLOW)).toBeLessThanOrEqual(0);
      await expectNoAxeViolations(page);
    });
  });
}

// The lightbox (GAL-02, C-35, D-30). The viewer shows the tiny demo photos.
const VIEWER = 'Gallery image viewer';

test('@gallery-lightbox pressing the third tile opens the viewer on it, Next wraps from the last item to the first and Esc closes', async ({
  page,
  request,
}) => {
  await withSiteContentLock(async () => {
    await seedDemoSiteContent(request);
    await page.goto('/gallery');
    const tiles = page.getByRole('main').getByRole('button', { name: /^Open / });
    await expect(tiles.first()).toBeVisible();
    const total = await tiles.count();

    await tiles.nth(2).click();
    const viewer = page.getByRole('dialog', { name: VIEWER });
    await expect(viewer).toBeVisible();
    await expect(viewer.getByText(`3 / ${String(total)}`)).toBeVisible();
    await expect(viewer.getByRole('button', { name: 'Close viewer' })).toBeFocused();

    // The arrow key works on every project: the phone projects hide the 56px buttons.
    for (let step = 3; step < total; step += 1) {
      await page.keyboard.press('ArrowRight');
    }
    await expect(viewer.getByText(`${String(total)} / ${String(total)}`)).toBeVisible();
    await page.keyboard.press('ArrowRight');
    await expect(viewer.getByText(`1 / ${String(total)}`)).toBeVisible();

    await page.keyboard.press('Escape');
    await expect(viewer).toBeHidden();
  });
});

const LONG_TEAM = 'Barangay Sampaguita Elementary School Varsity Basketball Team of Sample City';

test('@gallery-lightbox the 56px buttons move between items on a desktop and the tap zones on a phone', async ({
  page,
  request,
  isMobile,
}) => {
  await withSiteContentLock(async () => {
    await seedDemoSiteContent(request);
    await page.goto('/gallery');
    const tiles = page.getByRole('main').getByRole('button', { name: /^Open / });
    await expect(tiles.first()).toBeVisible();
    const total = await tiles.count();
    await tiles.first().click();
    const viewer = page.getByRole('dialog', { name: VIEWER });
    await expect(viewer.getByText(`1 / ${String(total)}`)).toBeVisible();

    const shownNames = isMobile
      ? { previous: 'Previous photo', next: 'Next photo' }
      : { previous: 'Previous image', next: 'Next image' };
    const hiddenNames = isMobile ? ['Previous image', 'Next image'] : ['Previous photo', 'Next photo'];
    for (const name of hiddenNames) {
      await expect(viewer.getByRole('button', { name })).toBeHidden();
    }
    const previous = viewer.getByRole('button', { name: shownNames.previous });
    const next = viewer.getByRole('button', { name: shownNames.next });
    await expect(previous).toBeVisible();
    await expect(next).toBeVisible();

    if (isMobile) {
      // The tap zones are the left and right thirds of the photo box, as tall as the box.
      const frame = await viewer.locator('[data-lightbox-frame]').boundingBox();
      const zone = await next.boundingBox();
      expect(frame).not.toBeNull();
      expect(zone).not.toBeNull();
      expect(Math.abs((zone?.width ?? 0) - (frame?.width ?? 0) / 3)).toBeLessThan(2);
      expect(Math.abs((zone?.height ?? 0) - (frame?.height ?? 0))).toBeLessThan(2);
      await next.tap();
    } else {
      const size = await next.boundingBox();
      expect(Math.round(size?.width ?? 0)).toBe(56);
      await next.click();
    }
    await expect(viewer.getByText(`2 / ${String(total)}`)).toBeVisible();
    await previous.click();
    await expect(viewer.getByText(`1 / ${String(total)}`)).toBeVisible();
    await previous.click();
    await expect(viewer.getByText(`${String(total)} / ${String(total)}`)).toBeVisible();
  });
});

// A horizontal pointer move over the photo box, as a finger drags it: down in the middle, then up `dx` pixels away.
const SWIPE = `(dx) => {
  const frame = document.querySelector('[data-lightbox-frame]');
  const box = frame.getBoundingClientRect();
  const x = box.left + box.width / 2;
  const y = box.top + box.height / 2;
  const at = (type, clientX) =>
    document.elementFromPoint(x, y).dispatchEvent(
      new PointerEvent(type, { bubbles: true, pointerId: 9, isPrimary: true, pointerType: 'touch', clientX, clientY: y }),
    );
  at('pointerdown', x);
  at('pointerup', x + dx);
}`;

test('@gallery-lightbox on a phone a swipe of 80px moves between items and one of 20px does not', async ({
  page,
  request,
  isMobile,
}) => {
  test.skip(!isMobile, 'the swipe is for the phone projects');
  await withSiteContentLock(async () => {
    await seedDemoSiteContent(request);
    await page.goto('/gallery');
    const tiles = page.getByRole('main').getByRole('button', { name: /^Open / });
    await expect(tiles.first()).toBeVisible();
    const total = await tiles.count();
    await tiles.first().click();
    const viewer = page.getByRole('dialog', { name: VIEWER });
    await expect(viewer.getByText(`1 / ${String(total)}`)).toBeVisible();

    await page.evaluate(`(${SWIPE})(-80)`);
    await expect(viewer.getByText(`2 / ${String(total)}`)).toBeVisible();
    await page.evaluate(`(${SWIPE})(80)`);
    await expect(viewer.getByText(`1 / ${String(total)}`)).toBeVisible();
    await page.evaluate(`(${SWIPE})(-20)`);
    await expect(viewer.getByText(`1 / ${String(total)}`)).toBeVisible();
  });
});

for (const width of [320, 1440]) {
  test(`@gallery-lightbox at ${String(width)}px a long team name wraps in the caption and nothing scrolls sideways`, async ({
    page,
    request,
  }) => {
    await withSiteContentLock(async () => {
      await seedDemoSiteContent(request);
      await page.route('**/api/v1/public/gallery', async (route) => {
        const response = await route.fetch();
        const body = (await response.json()) as { items: { team: string }[] };
        const first = body.items[0];
        if (first !== undefined) {
          first.team = LONG_TEAM;
        }
        await route.fulfill({ response, json: body });
      });
      await page.setViewportSize({ width, height: 800 });
      await page.goto('/gallery');
      await page
        .getByRole('main')
        .getByRole('button', { name: /^Open / })
        .first()
        .click();
      const viewer = page.getByRole('dialog', { name: VIEWER });
      const team = viewer.getByText(LONG_TEAM);
      await expect(team).toBeVisible();

      const box = await team.boundingBox();
      if (width === 320) {
        expect(box?.height ?? 0, 'the long name takes more than one line').toBeGreaterThan(40);
      }
      expect((box?.x ?? 0) + (box?.width ?? 0)).toBeLessThanOrEqual(width);
      expect(await page.evaluate<number>(SIDEWAYS_OVERFLOW)).toBeLessThanOrEqual(0);
      await expectNoAxeViolations(page);
    });
  });
}

test('@gallery-lightbox the browser Back button closes the viewer, stays on the Gallery with the same category and focuses the last tile shown', async ({
  page,
  request,
}) => {
  await withSiteContentLock(async () => {
    await seedDemoSiteContent(request);
    await page.goto('/gallery?category=basketball');
    const tiles = page.getByRole('main').getByRole('button', { name: /^Open / });
    await expect(tiles.first()).toBeVisible();
    const total = await tiles.count();
    await tiles.first().click();
    const viewer = page.getByRole('dialog', { name: VIEWER });
    await expect(viewer.getByRole('button', { name: 'Close viewer' })).toBeFocused();
    await page.keyboard.press('ArrowRight');
    await expect(viewer.getByText(`${String((1 % total) + 1)} / ${String(total)}`)).toBeVisible();

    await page.evaluate('document.fonts.ready.then(() => true)');
    await page.goBack();

    await expect(viewer).toBeHidden();
    await expect(page).toHaveURL(/\/gallery\?category=basketball$/);
    await expect(tiles.nth(1 % total)).toBeFocused();
  });
});

test('@gallery-lightbox Esc leaves no extra history entry: Back from the Gallery goes to the page before it', async ({
  page,
  request,
}) => {
  await withSiteContentLock(async () => {
    await seedDemoSiteContent(request);
    await page.goto('/');
    await page.goto('/gallery');
    const tiles = page.getByRole('main').getByRole('button', { name: /^Open / });
    await expect(tiles.first()).toBeVisible();
    await tiles.nth(2).click();
    const viewer = page.getByRole('dialog', { name: VIEWER });
    // The viewer is ready once its chunk has loaded and Close has the focus; Esc before that has nothing to answer it.
    await expect(viewer.getByRole('button', { name: 'Close viewer' })).toBeFocused();

    await page.keyboard.press('Escape');
    await expect(viewer).toBeHidden();
    await expect(tiles.nth(2)).toBeFocused();

    // The viewer's display font loads when it first opens; leaving before it is in would abort that download (Firefox logs it).
    await page.evaluate('document.fonts.ready.then(() => true)');
    await page.goBack();
    await expect(page).toHaveURL(/\/$/);
    // The page before it is still loading its own fonts; ending the test now would abort them (Firefox logs it).
    await page.waitForLoadState('load');
    await page.evaluate('document.fonts.ready.then(() => true)');
  });
});

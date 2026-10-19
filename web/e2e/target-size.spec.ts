// Touch-target size in the browser (WR-20, CLAUDE.md 44 px rule; plan 05-50). The phone menu button, the sidebar toggle and
// the filter-chip clear keep their drawn size (D-31 O-8) and answer a tap anywhere in an invisible 44 x 44 px square
// centred on them. The probes ask the browser what is under a point, so they measure what a tap would actually hit.
import type { APIRequestContext, Page } from '@playwright/test';
import { signInAs } from './auth.ts';
import { expect, test } from './fixtures.ts';
import { createStaff } from './testing-api.ts';

/** What the probe reports for one control: its drawn box and the probe points that hit another element. */
interface ProbeResult {
  readonly width: number;
  readonly height: number;
  readonly misses: readonly string[];
}

// A page script (the node program has no DOM): for each visible element matching the selector, scrolls it to the middle
// of the viewport, then hit-tests its centre and the eight points 21 px away along each axis and diagonal, which lie
// inside a 44 x 44 px square centred on it. A hit on the element or a node inside it counts.
function probeTapAreas(selector: string): string {
  return `(() => {
    const results = [];
    for (const element of document.querySelectorAll(${JSON.stringify(selector)})) {
      if (element.getClientRects().length === 0) {
        continue;
      }
      element.scrollIntoView({ block: 'center', inline: 'center', behavior: 'instant' });
      const box = element.getBoundingClientRect();
      const x = box.left + box.width / 2;
      const y = box.top + box.height / 2;
      const misses = [];
      for (const [dx, dy] of [[0, 0], [21, 0], [-21, 0], [0, 21], [0, -21], [21, 21], [21, -21], [-21, 21], [-21, -21]]) {
        const hit = document.elementFromPoint(x + dx, y + dy);
        if (hit === null || !(hit === element || element.contains(hit))) {
          misses.push(dx + ',' + dy);
        }
      }
      results.push({ width: box.width, height: box.height, misses });
    }
    return results;
  })()`;
}

/** Asserts every visible control matching `selector` (at least `count` of them) is drawn `size` px square and answers a tap anywhere in the 44 px square around it. */
async function expectTapAreas(page: Page, selector: string, size: number, count = 1): Promise<void> {
  const results = await page.evaluate<ProbeResult[]>(probeTapAreas(selector));
  expect(results.length, `visible controls matching ${selector}`).toBeGreaterThanOrEqual(count);
  for (const result of results) {
    expect(result.misses, `probe offsets that missed ${selector}`).toEqual([]);
    expect({ width: result.width, height: result.height }, `drawn size of ${selector}`).toEqual({
      width: size,
      height: size,
    });
  }
}

/** What the drawn-box sweep reports: how many controls it checked and the points that hit something else. */
interface SweepResult {
  readonly checked: number;
  readonly failures: readonly string[];
}

// A page script: for every visible button, link, input and select, scrolls it to the middle of the viewport and hit-tests
// the centre and the four corners of its drawn box, each inset by 2 px (more on a rounded corner, so a pill or a circle
// is not asked to answer outside its curve). Each point must hit the control or a node inside it, so no tap area covers
// another control's drawn box. A control with no room (under 8 px), with pointer events off or with its centre outside
// the viewport (a skip link waiting off-screen) cannot be tapped and is not checked.
const SWEEP_DRAWN_BOXES = `(() => {
  const failures = [];
  let checked = 0;
  for (const element of document.querySelectorAll('button, a[href], input, select')) {
    const style = getComputedStyle(element);
    if (element.getClientRects().length === 0 || style.visibility === 'hidden' || style.pointerEvents === 'none') {
      continue;
    }
    element.scrollIntoView({ block: 'center', inline: 'center', behavior: 'instant' });
    const box = element.getBoundingClientRect();
    const centreX = box.left + box.width / 2;
    const centreY = box.top + box.height / 2;
    if (box.width < 8 || box.height < 8 || centreX < 0 || centreY < 0 || centreX >= innerWidth || centreY >= innerHeight) {
      continue;
    }
    checked += 1;
    const radius = Math.min(parseFloat(style.borderTopLeftRadius) || 0, box.width / 2, box.height / 2);
    const inset = 2 + 0.3 * radius;
    const points = [
      [box.width / 2, box.height / 2],
      [inset, inset],
      [box.width - inset, inset],
      [inset, box.height - inset],
      [box.width - inset, box.height - inset],
    ];
    for (const [px, py] of points) {
      const x = box.left + px;
      const y = box.top + py;
      if (x < 0 || y < 0 || x >= innerWidth || y >= innerHeight) {
        continue;
      }
      const hit = document.elementFromPoint(x, y);
      if (hit === null || !(hit === element || element.contains(hit))) {
        const name = element.getAttribute('aria-label') ?? element.textContent?.trim().slice(0, 30) ?? '';
        failures.push(element.tagName.toLowerCase() + ' "' + name + '" at ' + Math.round(px) + ',' + Math.round(py) + ' hit ' + (hit === null ? 'nothing' : hit.tagName.toLowerCase() + '.' + String(hit.className).slice(0, 40)));
      }
    }
  }
  return { checked, failures };
})()`;

/** Signs a Manager in and opens /admin/users at the size with the Role and Status filters set, so two chips show. */
async function openUsersWithChips(
  page: Page,
  request: APIRequestContext,
  size: { readonly width: number; readonly height: number },
): Promise<void> {
  const manager = await createStaff(request, 'Manager');
  await signInAs(page, request, manager);
  await page.setViewportSize(size);
  await page.goto('/admin/users');
  await expect(page.getByRole('heading', { level: 1, name: 'Users' })).toBeVisible();
  await page.getByRole('combobox', { name: 'Role' }).selectOption('manager');
  await page.getByRole('combobox', { name: 'Status' }).selectOption('active');
  await expect(page.getByRole('button', { name: /^Clear .+ filter$/ })).toHaveCount(2);
}

async function expectNoCoveredControls(page: Page): Promise<void> {
  const sweep = await page.evaluate<SweepResult>(SWEEP_DRAWN_BOXES);
  expect(sweep.checked, 'controls checked').toBeGreaterThan(10);
  expect(sweep.failures, 'drawn-box points that hit another element').toEqual([]);
}

const CHIP_CLEAR = 'button[aria-label^="Clear "][aria-label$=" filter"]';

for (const size of [
  { width: 390, height: 844 },
  { width: 1280, height: 900 },
] as const) {
  const at = `${String(size.width)} px`;

  test(`@target-size at ${at} each filter chip clear answers a tap anywhere in a 44 px square and is still drawn 22 px`, async ({
    page,
    request,
    guard,
  }) => {
    test.setTimeout(90_000);
    guard.expectStatus('/api/v1/auth/refresh', 401);
    await openUsersWithChips(page, request, size);

    await expectTapAreas(page, CHIP_CLEAR, 22, 2);
  });

  test(`@target-size at ${at} no tap area covers another control's drawn box on the Users page`, async ({
    page,
    request,
    guard,
  }) => {
    test.setTimeout(90_000);
    guard.expectStatus('/api/v1/auth/refresh', 401);
    await openUsersWithChips(page, request, size);

    await expectNoCoveredControls(page);
  });
}

test('@target-size on a desktop the Collapse sidebar button answers a tap anywhere in a 44 px square and is still drawn 36 px', async ({
  page,
  request,
  guard,
}) => {
  test.setTimeout(90_000);
  guard.expectStatus('/api/v1/auth/refresh', 401);
  const manager = await createStaff(request, 'Manager');
  await signInAs(page, request, manager);

  await page.setViewportSize({ width: 1280, height: 900 });
  await page.goto('/admin/users');
  await expect(page.getByRole('heading', { level: 1, name: 'Users' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Collapse sidebar' })).toBeVisible();

  await expectTapAreas(page, 'aside button[aria-label="Collapse sidebar"]', 36);
});

test('@target-size on a phone the Open navigation button answers a tap anywhere in a 44 px square and is still drawn 36 px', async ({
  page,
  request,
  guard,
}) => {
  test.setTimeout(90_000);
  guard.expectStatus('/api/v1/auth/refresh', 401);
  const manager = await createStaff(request, 'Manager');
  await signInAs(page, request, manager);

  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/admin/users');
  await expect(page.getByRole('heading', { level: 1, name: 'Users' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Open navigation' })).toBeVisible();

  await expectTapAreas(page, 'button[aria-label="Open navigation"]', 36);
});

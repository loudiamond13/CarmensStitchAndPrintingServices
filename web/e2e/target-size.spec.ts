// Touch-target size in the browser (WR-20, CLAUDE.md 44 px rule; plan 05-50). The phone menu button, the sidebar toggle and
// the filter-chip clear keep their drawn size (D-31 O-8) and answer a tap anywhere in an invisible 44 x 44 px square
// centred on them. The probes ask the browser what is under a point, so they measure what a tap would actually hit.
import type { Page } from '@playwright/test';
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

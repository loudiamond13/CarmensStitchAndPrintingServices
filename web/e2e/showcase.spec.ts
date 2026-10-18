// Component Showcase E2E (D-22, WEB-06, A11Y-01; plan 02-34): /dev/components on the real host (the e2e bundle has the
// dev-only routes) in all five projects, in Blush and in Espresso (switched with the shell's own toggle, D-13). Each
// run checks one h1, the eleven sections, no "Missing component" alert, a page-level axe pass over every case, and the
// guard (no console, page, CSP or failed-response findings). Then: nothing in the showcase widens the page at 320px
// (the 4-chip FilterBar fixture wraps), the toast triggers raise a toast in each tone, a picked image previews under
// the strict CSP (UI-CR-01: a `data:` URL, never a blocked `blob:` one), and an open Delete Order dialog is axe-clean
// too.
// Plan 05-42 adds the Staff and audit section (UI-SPEC C1): its panels, dialogs and tabs are live demos on made-up data.
// Since plan 05-35 (D-30..D-33) the same page also ships at /admin/components for Managers, marked as demo data; the
// tests at the end of this file prove it on the real host: banner and badge first, no CSP or console finding, no API call
// other than the session refresh, no sideways scroll at 320 and 1920 px, and an Admin sent on to /admin.
import type { Page } from '@playwright/test';
import { signInAs } from './auth.ts';
import { expect, expectNoAxeViolations, test } from './fixtures.ts';
import { createStaff } from './testing-api.ts';

const SECTIONS = [
  'Brand & icons',
  'Buttons',
  'Status',
  'Forms',
  'Data',
  'Feedback',
  'Media',
  'Navigation',
  'Marketing',
  'Sign-in and devices',
  'Staff and audit',
];

/**
 * Opens the showcase and waits for its page head. About 190 cases: under a full parallel run these tests get the same
 * longer timeout as keyboard.spec.ts (deferred-items.md, plan 02-35 showcase timing flake).
 */
async function openShowcase(page: Page): Promise<void> {
  test.setTimeout(120_000);
  const response = await page.goto('/dev/components');
  expect(response?.status()).toBe(200);
  await expect(page.locator('h1')).toHaveText('Component Showcase');
}

const THEMES = [
  { name: 'Blush', theme: 'light' },
  { name: 'Espresso', theme: 'dark' },
] as const;

for (const { name, theme } of THEMES) {
  test(`@showcase /dev/components in ${name}: every section, one h1, no axe findings`, async ({ page }) => {
    await openShowcase(page);
    const root = page.locator('[data-theme]').first();
    if (theme === 'dark') {
      // The shell's Topbar comes first; the Topbar cases inside main carry toggles of their own.
      await page.getByRole('button', { name: 'Switch to dark mode' }).first().click();
    }
    await expect(root).toHaveAttribute('data-theme', theme);

    await expect(page.locator('h1')).toHaveCount(1);
    await expect(page).toHaveTitle('Component Showcase · CSPS Admin');
    await expect(page.getByRole('main')).toHaveCount(1);
    await expect(page.locator('main > section > div > h2')).toHaveText(SECTIONS);
    await expect(page.locator('[data-case]')).not.toHaveCount(0);
    await expect(page.getByText(/^Missing component/)).toHaveCount(0);
    // No sidebar item claims the showcase page.
    await expect(page.locator('[data-ui="s-admin-side"] [aria-current="page"]')).toHaveCount(0);

    await expectNoAxeViolations(page);
  });
}

test('@showcase nothing in the showcase widens the page at 320px, and the 4-chip FilterBar fixture wraps', async ({
  page,
}) => {
  await page.setViewportSize({ width: 320, height: 800 });
  await openShowcase(page);

  const chips = page.locator('[data-case="filterbar-chips-4"]');
  await expect(chips).toBeVisible();
  const sizes = await page.evaluate<{
    readonly page: number;
    readonly viewport: number;
    readonly main: number;
    readonly mainClient: number;
    readonly chips: number;
    readonly chipsClient: number;
    readonly chipRows: number;
  }>(`(() => {
    const main = document.querySelector('main');
    const chips = document.querySelector('[data-case="filterbar-chips-4"]');
    const tops = new Set([...chips.querySelectorAll('button')].map((button) => Math.round(button.getBoundingClientRect().top)));
    return {
      page: document.documentElement.scrollWidth,
      viewport: window.innerWidth,
      main: main.scrollWidth,
      mainClient: main.clientWidth,
      chips: chips.scrollWidth,
      chipsClient: chips.clientWidth,
      chipRows: tops.size,
    };
  })()`);
  // The showcase content stays inside main (every case frame keeps a wide case inside its own scrollport), and since
  // D-41 R2-01 (owner, 2026-10-13) the admin Topbar fits too, so the page never scrolls sideways at 320px.
  expect(sizes.main).toBeLessThanOrEqual(sizes.mainClient);
  expect(sizes.page).toBeLessThanOrEqual(sizes.viewport);
  // The chips wrap onto new rows instead of scrolling sideways (UI-SPEC UI Considerations: overflow, FilterBar).
  expect(sizes.chips).toBeLessThanOrEqual(sizes.chipsClient);
  expect(sizes.chipRows).toBeGreaterThan(1);
});

test('@showcase the toast triggers raise a toast in each tone', async ({ page }) => {
  await openShowcase(page);
  const layer = page.locator('[data-ui="s-toast-layer"]');

  for (const [trigger, title] of [
    ['Show success toast', 'Payment added'],
    ['Show info toast', 'Not available yet'],
    ['Show warning toast', 'Someone else changed this'],
    ['Show danger toast', "Couldn't save order"],
  ] as const) {
    await page.getByRole('button', { name: trigger }).click();
    await expect(layer.getByText(title)).toBeVisible();
    // On phones the stack sits over the page bottom: close each toast so it never covers the next trigger.
    await layer.getByRole('button', { name: 'Dismiss' }).click();
    await expect(layer.getByText(title)).toHaveCount(0);
  }
});

/** A 1×1 PNG, so the preview has pixels to decode. */
const ONE_PIXEL_PNG = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==',
  'base64',
);

test('@showcase a picked image previews under the strict CSP (UI-CR-01)', async ({ page }) => {
  await openShowcase(page);
  const uploader = page.locator('[data-case="uploader-empty"]');
  await uploader.locator('input[type="file"]').setInputFiles({
    name: 'pixel.png',
    mimeType: 'image/png',
    buffer: ONE_PIXEL_PNG,
  });
  const preview = uploader.getByRole('img', { name: 'pixel.png' });
  await expect(preview).toBeVisible();
  // The browser decoded it: an image the CSP blocked would have no natural size (and the guard reports the violation).
  const naturalWidth = `document.querySelector('[data-case="uploader-empty"] img[alt="pixel.png"]').naturalWidth`;
  await expect.poll(() => page.evaluate<number>(naturalWidth)).toBe(1);
  expect(await preview.getAttribute('src')).toMatch(/^data:image\/png;base64,/);
});

test('@showcase the Delete Order demo opens an axe-clean dialog and deletes nothing', async ({ page }) => {
  await openShowcase(page);
  const trigger = page.locator('[data-case="confirm-delete-order"]').getByRole('button', { name: 'Open Delete Order' });

  await trigger.click();
  const dialog = page.getByRole('dialog', { name: 'Delete order ORD-2026-0148?' });
  await expect(dialog).toBeVisible();
  await expectNoAxeViolations(page);

  await dialog.getByRole('textbox').fill('ORD-2026-0148');
  await dialog.getByRole('button', { name: 'Delete Order' }).click();
  await expect(dialog).toHaveCount(0);
  await expect(page.locator('[data-ui="s-toast-layer"]').getByText('Order ORD-2026-0148 deleted')).toBeVisible();
});

/** The Demo data banner of D-32. */
const DEMO_BANNER =
  'Demo data. Every order, name and amount on this page is made up to show the design. Nothing here is a real record.';

test('@showcase a Manager opens /admin/components: Demo data badge and banner first, axe-clean, and no API call but the session refresh (D-30, D-32, D-33)', async ({
  page,
  request,
  guard,
}) => {
  test.setTimeout(180_000);
  // Opening the sign-in page asks the refresh cookie for a session first; with none that answer is a 401.
  guard.expectStatus('/api/v1/auth/refresh', 401);
  const manager = await createStaff(request, 'Manager');
  await signInAs(page, request, manager);

  const calls: string[] = [];
  page.on('request', (call) => {
    if (call.url().includes('/api/v1/')) {
      calls.push(new URL(call.url()).pathname);
    }
  });
  const response = await page.goto('/admin/components');
  expect(response?.status()).toBe(200);
  await expect(page.locator('h1')).toHaveText('Component Showcase');
  await expect(page).toHaveTitle('Component Showcase · CSPS Admin');
  await expect(page.getByRole('main')).toHaveCount(1);

  // The badge sits in the page head; the banner is the first block of main after it.
  await expect(page.locator('main > div').first().getByText('Demo data', { exact: true })).toBeVisible();
  await expect(page.locator('main > div').nth(1)).toHaveText(DEMO_BANNER);
  await expect(page.locator('main > section').first()).toBeVisible();
  await expect(page.locator('main > section > div > h2')).toHaveCount(11);
  await expect(page.getByText(/^Missing component/)).toHaveCount(0);
  // No sidebar item claims the page, and the sidebar has no link to it.
  await expect(page.locator('[data-ui="s-admin-side"] [aria-current="page"]')).toHaveCount(0);
  await expect(page.locator('a[href="/admin/components"]')).toHaveCount(0);

  await expectNoAxeViolations(page);
  expect([...new Set(calls)]).toEqual(['/api/v1/auth/refresh']);
});

for (const width of [320, 1920]) {
  test(`@showcase /admin/components does not scroll sideways at ${String(width)}px (D-33)`, async ({
    page,
    request,
    guard,
  }) => {
    test.setTimeout(180_000);
    guard.expectStatus('/api/v1/auth/refresh', 401);
    const manager = await createStaff(request, 'Manager');
    await signInAs(page, request, manager);
    await page.setViewportSize({ width, height: 900 });

    await page.goto('/admin/components');
    await expect(page.locator('h1')).toHaveText('Component Showcase');
    await expect(page.getByText(DEMO_BANNER)).toBeVisible();

    expect(await page.evaluate<boolean>('document.documentElement.scrollWidth <= window.innerWidth')).toBe(true);
  });
}

test('@showcase an Admin who opens /admin/components is sent on to /admin and never sees the showcase (D-31)', async ({
  page,
  request,
  guard,
}) => {
  guard.expectStatus('/api/v1/auth/refresh', 401);
  const admin = await createStaff(request, 'Admin');
  await signInAs(page, request, admin);

  await page.goto('/admin/components');

  await expect(page).toHaveURL(/\/admin(\/sessions)?$/);
  await expect(page.getByRole('heading', { level: 1, name: 'Component Showcase' })).toHaveCount(0);
  await expect(page.getByText(DEMO_BANNER)).toHaveCount(0);
});

const PASSWORD_SAMPLE = /^[A-Za-z]+-[A-Za-z]+-\d{4}$/;

test('@showcase the Staff and audit demos open and close for a Manager, show a sample password once, and call no API but the session refresh (D-32, D-33)', async ({
  page,
  request,
  guard,
}) => {
  test.setTimeout(180_000);
  guard.expectStatus('/api/v1/auth/refresh', 401);
  const manager = await createStaff(request, 'Manager');
  await signInAs(page, request, manager);

  const calls: string[] = [];
  page.on('request', (call) => {
    if (call.url().includes('/api/v1/')) {
      calls.push(new URL(call.url()).pathname);
    }
  });
  await page.goto('/admin/components');
  await expect(page.locator('h1')).toHaveText('Component Showcase');
  const staff = page.getByRole('region', { name: 'Staff and audit' });
  await expect(staff).toBeVisible();
  await expect(staff.locator('[data-case="staff-roster-rows"]')).toBeVisible();

  // Add User by the temporary password route: the shown-once step carries a sample value.
  await staff.getByRole('button', { name: 'Open Add User (temporary password)' }).click();
  const panel = page.getByRole('dialog', { name: 'Add User' });
  await expect(panel).toBeVisible();
  await panel.getByRole('button', { name: 'Create User' }).click();
  const created = page.getByRole('dialog', { name: 'User created' });
  await expect(created.getByLabel('Temporary password for Ana')).toHaveValue(PASSWORD_SAMPLE);
  await expectNoAxeViolations(page);
  await created.getByRole('button', { name: 'Done' }).click();
  await expect(created).toHaveCount(0);

  // The confirm dialogs open and close (they play their motion), and confirming only closes them.
  for (const [trigger, title, button] of [
    ['Open Deactivate User', 'Deactivate Paolo Garcia?', 'Keep Active'],
    ['Open Lock User', 'Lock Paolo Garcia?', 'Keep Unlocked'],
    ['Open Delete User', 'Delete Paolo Garcia?', 'Cancel'],
    ['Open Set Temporary Password', 'Set a temporary password', 'Cancel'],
  ] as const) {
    await staff.getByRole('button', { name: trigger }).click();
    const dialog = page.getByRole('dialog', { name: title });
    await expect(dialog).toBeVisible();
    await dialog.getByRole('button', { name: button }).click();
    await expect(dialog).toHaveCount(0);
  }

  // The profile tabs switch panel.
  await staff.getByRole('tab', { name: 'Security' }).click();
  await expect(staff.getByRole('tabpanel', { name: 'Security' })).toBeVisible();

  expect([...new Set(calls)]).toEqual(['/api/v1/auth/refresh']);
});

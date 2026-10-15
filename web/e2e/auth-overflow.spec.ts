// Overflow and accessibility sweep of the sign-in screens and S7 (plan 04-32; UI-SPEC "UI Considerations" backstops;
// PERF-03, A11Y-01, WCAG 1.4.10). Every auth screen (S1 to S6, including the invalid and sent states) and the Signed-in
// devices page (S7, in Blush and Espresso) is checked at 320, 375, 414, 768, 1024, 1280, 1536 and 1920 px wide, in portrait
// (taller than wide) and in landscape (wider than tall). At every size:
//   - no horizontal scroll: `document.documentElement.scrollWidth <= innerWidth`;
//   - exactly one h1 and one `main#main`, and the skip link "Skip to main content" first in the keyboard order;
//   - zero axe findings (and, through the shared guard, zero console, page-error, CSP or failed-response findings).
// The long-text backstops ride along: a 64-character e-mail address in the S2, S4, S5 and S6 sublines, a 5xx banner with its
// reference on S1, a 60-character device label and two rows with one label on S7, and the session-cap and S7 toasts, all
// checked at 320 px.
// Every failure is collected and the list is asserted empty at the end, so one run names every failing size and screen. The
// desktop projects sweep all eight widths; the phone projects (Pixel 7, iPhone 15) check their own screen in both
// orientations. The answers that would need a real invite, reset link or code are served by page.route, so the sweep needs no
// mail and never touches the per-address limits; the sign-in of S7 is real.
import type { Page, Route, TestInfo } from '@playwright/test';
import { signInAs } from './auth.ts';
import { expect, test, type Guard } from './fixtures.ts';
import { createStaff } from './testing-api.ts';
import { axeFindings, settle } from './sweep.ts';

const WIDTHS = [320, 375, 414, 768, 1024, 1280, 1536, 1920] as const;

/** A 64-character e-mail address (UI-SPEC long-text). */
const LONG_EMAIL = 'maria.concepcion.villanueva.dela.cruz.j@barangay-sanroque.gov.ph';
const TRACE_ID = '00-4bf92f3577b34da6a3ce929d0e0e4736-01';

/** A 60-character device label, and two rows that share one label. */
const LONG_LABEL = 'Samsung Internet on Galaxy Tab S9 Ultra at the front counter';

interface Size {
  readonly label: string;
  readonly width: number;
  readonly height: number;
}

/** The width under test stays fixed; the orientation sets the height (16:9 taller than wide, or 9:16 wider than tall). */
function sizesFor(testInfo: TestInfo): readonly Size[] {
  const device = testInfo.project.use.viewport;
  if (testInfo.project.name === 'pixel' || testInfo.project.name === 'iphone') {
    const width = device?.width ?? 390;
    const height = device?.height ?? 844;
    return [
      { label: `${String(width)}x${String(height)} portrait`, width, height },
      { label: `${String(height)}x${String(width)} landscape`, width: height, height: width },
    ];
  }
  return WIDTHS.flatMap((width) => [
    { label: `${String(width)}px portrait`, width, height: Math.round((width * 16) / 9) },
    { label: `${String(width)}px landscape`, width, height: Math.round((width * 9) / 16) },
  ]);
}

interface Reading {
  readonly scrollWidth: number;
  readonly innerWidth: number;
  readonly h1s: number;
  readonly mains: number;
  readonly firstFocusable: string | null;
  /** The outermost elements that reach past the right edge (fixed layers and clipped content excluded). */
  readonly offenders: readonly string[];
}

const READ = `(() => {
  const edge = document.documentElement.clientWidth + 0.5;
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
  const first = document.querySelector('a[href], button, input, select, textarea, [tabindex]:not([tabindex="-1"])');
  return {
    scrollWidth: document.documentElement.scrollWidth,
    innerWidth: window.innerWidth,
    h1s: document.querySelectorAll('h1').length,
    mains: document.querySelectorAll('main#main').length,
    firstFocusable: first ? (first.textContent || '').trim() : null,
    offenders: outermost.map((element) => element.tagName.toLowerCase() + ' right ' + Math.round(element.getBoundingClientRect().right)),
  };
})()`;

/** Checks the open screen at one size and returns its problems (empty when it passes). */
async function checkSize(page: Page): Promise<string[]> {
  const problems: string[] = [];
  const reading = await page.evaluate<Reading>(READ);
  if (reading.scrollWidth > reading.innerWidth) {
    problems.push(
      `scrolls sideways: scrollWidth ${String(reading.scrollWidth)} > innerWidth ${String(reading.innerWidth)} (${reading.offenders.join('; ') || 'no element found'})`,
    );
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
  for (const finding of await axeFindings(page)) {
    problems.push(`axe ${finding}`);
  }
  return problems;
}

/** Resizes to every size of the project and collects what `checkSize` finds. */
async function sweep(page: Page, testInfo: TestInfo, name: string): Promise<string[]> {
  const failures: string[] = [];
  for (const size of sizesFor(testInfo)) {
    await page.setViewportSize({ width: size.width, height: size.height });
    await settle(page);
    for (const problem of await checkSize(page)) {
      failures.push(`${name} at ${size.label}: ${problem}`);
    }
  }
  return failures;
}

/** The first size, so a screen opens at the width the sweep starts with. */
async function startSize(page: Page, testInfo: TestInfo): Promise<void> {
  const first = sizesFor(testInfo)[0];
  await page.setViewportSize({ width: first?.width ?? 320, height: first?.height ?? 640 });
}

function json(route: Route, status: number, body: unknown): Promise<void> {
  return route.fulfill({ status, contentType: 'application/json', body: JSON.stringify(body) });
}

/** Opening a sign-in page asks the refresh cookie for a session first; with none that answer is a 401. */
function expectRefresh401(guard: Guard): void {
  guard.expectStatus('/api/v1/auth/refresh', 401);
}

test.describe('@auth-overflow the sign-in screens', () => {
  // Sixteen sizes with a page-level axe run each, in four engines and two phones.
  test.describe.configure({ timeout: 300_000 });

  test('S1 Sign in', async ({ page, guard }, testInfo) => {
    expectRefresh401(guard);
    await startSize(page, testInfo);
    await page.goto('/admin/login');
    await expect(page.getByRole('heading', { level: 1, name: 'Sign in' })).toBeVisible();
    expect(await sweep(page, testInfo, 'S1')).toEqual([]);
  });

  test('S1 Sign in with a 5xx banner that carries its reference wraps at every width', async ({
    page,
    guard,
  }, testInfo) => {
    expectRefresh401(guard);
    guard.expectStatus('/api/v1/auth/sign-in', 500);
    await page.route('**/api/v1/auth/sign-in', (route) =>
      route.fulfill({
        status: 500,
        contentType: 'application/problem+json',
        body: JSON.stringify({ title: 'Internal Server Error', status: 500, traceId: TRACE_ID }),
      }),
    );
    await startSize(page, testInfo);
    await page.goto('/admin/login');
    await page.getByLabel('Email').fill('paolo.garcia@gmail.com');
    await page.getByLabel('Password', { exact: true }).fill('Mabuhay#Tahi2026');
    await page.getByRole('button', { name: 'Sign In' }).click();
    await expect(page.getByRole('alert')).toContainText(TRACE_ID);
    expect(await sweep(page, testInfo, 'S1 banner')).toEqual([]);
  });

  test('S2 Check your email, with a 64-character address', async ({ page, guard }, testInfo) => {
    expectRefresh401(guard);
    await page.route('**/api/v1/auth/sign-in', (route) => json(route, 200, { resendAfterSeconds: 60 }));
    await startSize(page, testInfo);
    await page.goto('/admin/login');
    await page.getByLabel('Email').fill(LONG_EMAIL);
    await page.getByLabel('Password', { exact: true }).fill('Mabuhay#Tahi2026');
    await page.getByRole('button', { name: 'Sign In' }).click();
    await expect(page.getByRole('heading', { level: 1, name: 'Check your email' })).toBeVisible();
    await expect(page.getByText(LONG_EMAIL)).toBeVisible();
    expect(await sweep(page, testInfo, 'S2')).toEqual([]);
  });

  test('S3 Set a new password', async ({ page, guard }, testInfo) => {
    expectRefresh401(guard);
    await startSize(page, testInfo);
    await page.goto('/admin/login/new-password');
    await expect(page.getByRole('heading', { level: 1, name: 'Set a new password' })).toBeVisible();
    expect(await sweep(page, testInfo, 'S3')).toEqual([]);
  });

  test('S4 Reset your password: the form and the sent state with a 64-character address', async ({
    page,
    guard,
  }, testInfo) => {
    expectRefresh401(guard);
    await page.route('**/api/v1/auth/password/forgot', (route) => route.fulfill({ status: 204 }));
    await startSize(page, testInfo);
    await page.goto('/admin/forgot-password');
    await expect(page.getByRole('heading', { level: 1, name: 'Reset your password' })).toBeVisible();
    const failures = await sweep(page, testInfo, 'S4 form');

    await startSize(page, testInfo);
    await page.getByLabel('Email').fill(LONG_EMAIL);
    await page.getByRole('button', { name: 'Send Reset Link' }).click();
    await expect(page.getByRole('heading', { level: 1, name: 'Check your email' })).toBeVisible();
    await expect(page.getByText(LONG_EMAIL)).toBeVisible();
    failures.push(...(await sweep(page, testInfo, 'S4 sent')));
    expect(failures).toEqual([]);
  });

  test('S5 Set a new password from the email link: the form and the invalid state', async ({
    page,
    guard,
  }, testInfo) => {
    expectRefresh401(guard);
    await page.route('**/api/v1/auth/password/reset/check', (route) => json(route, 200, { email: LONG_EMAIL }));
    await startSize(page, testInfo);
    await page.goto('/admin/reset-password#token=abcdefghijklmnopqrstuvwxyz0123456789ABCDEFG');
    await expect(page.getByLabel('New password', { exact: true })).toBeVisible();
    await expect(page.getByText(LONG_EMAIL)).toBeVisible();
    const failures = await sweep(page, testInfo, 'S5 form');

    await startSize(page, testInfo);
    await page.goto('/admin/reset-password');
    await expect(page.getByRole('heading', { level: 1, name: 'This link has expired' })).toBeVisible();
    failures.push(...(await sweep(page, testInfo, 'S5 invalid')));
    expect(failures).toEqual([]);
  });

  test('S6 Set your password from an invite: the form and the invalid state', async ({ page, guard }, testInfo) => {
    expectRefresh401(guard);
    await page.route('**/api/v1/auth/invite/check', (route) =>
      json(route, 200, { email: LONG_EMAIL, firstName: 'Maria' }),
    );
    await startSize(page, testInfo);
    await page.goto('/admin/accept-invite#token=abcdefghijklmnopqrstuvwxyz0123456789ABCDEFG');
    await expect(page.getByLabel('New password', { exact: true })).toBeVisible();
    await expect(page.getByText(LONG_EMAIL)).toBeVisible();
    const failures = await sweep(page, testInfo, 'S6 form');

    await startSize(page, testInfo);
    await page.goto('/admin/accept-invite');
    await expect(page.getByRole('heading', { level: 1, name: 'This invite has expired' })).toBeVisible();
    failures.push(...(await sweep(page, testInfo, 'S6 invalid')));
    expect(failures).toEqual([]);
  });
});

/** The device list S7 shows: this device, a 60-character label, and two rows with one label (UI-SPEC S7). */
function deviceList(): unknown[] {
  const now = Date.now();
  const ago = (minutes: number): string => new Date(now - minutes * 60_000).toISOString();
  return [
    {
      id: '00000000-0000-4000-8000-000000000001',
      device: 'Chrome on Windows',
      signedInAt: ago(600),
      lastActiveAt: ago(0),
      persistent: true,
      current: true,
    },
    {
      id: '00000000-0000-4000-8000-000000000002',
      device: 'Safari on iPhone',
      signedInAt: ago(1500),
      lastActiveAt: ago(5),
      persistent: true,
      current: false,
    },
    {
      id: '00000000-0000-4000-8000-000000000003',
      device: LONG_LABEL,
      signedInAt: ago(2900),
      lastActiveAt: ago(95),
      persistent: false,
      current: false,
    },
    {
      id: '00000000-0000-4000-8000-000000000004',
      device: 'Edge on Windows',
      signedInAt: ago(1200),
      lastActiveAt: ago(600),
      persistent: true,
      current: false,
    },
    {
      id: '00000000-0000-4000-8000-000000000005',
      device: 'Edge on Windows',
      signedInAt: ago(6000),
      lastActiveAt: ago(3000),
      persistent: false,
      current: false,
    },
  ];
}

for (const theme of ['light', 'dark'] as const) {
  test(`@auth-overflow S7 Signed-in devices (${theme === 'light' ? 'Blush' : 'Espresso'}): table, scrolling wrapper and cards fit every width`, async ({
    page,
    request,
    guard,
  }, testInfo) => {
    // A real sign-in, then sixteen sizes with a page-level axe run each.
    testInfo.setTimeout(420_000);
    expectRefresh401(guard);
    const staff = await createStaff(request, 'Manager');
    await signInAs(page, request, staff);

    // The theme is the admin shell's saved choice (D-13), read before the first script runs.
    await page.addInitScript({ content: `try { localStorage.setItem('csps-theme', '${theme}'); } catch {}` });
    await page.route(
      (url) => url.pathname === '/api/v1/sessions',
      (route) => (route.request().method() === 'GET' ? json(route, 200, deviceList()) : route.fallback()),
    );
    await startSize(page, testInfo);
    await page.goto('/admin/sessions');
    await expect(page.getByRole('heading', { level: 1, name: 'Signed-in devices' })).toBeVisible();
    await expect(page.locator('[data-theme]').first()).toHaveAttribute('data-theme', theme);
    await expect(page.getByText(LONG_LABEL).first()).toBeVisible();

    expect(await sweep(page, testInfo, `S7 (${theme})`)).toEqual([]);
  });
}

test('@auth-overflow the session-cap and S7 toasts wrap inside a 320px window', async ({
  page,
  request,
  guard,
}, testInfo) => {
  testInfo.setTimeout(180_000);
  expectRefresh401(guard);
  const staff = await createStaff(request, 'Manager');
  await signInAs(page, request, staff);

  await page.setViewportSize({ width: 320, height: 640 });
  await page.goto('/dev/components');
  await expect(page.getByRole('heading', { level: 1, name: 'Component Showcase' })).toBeVisible();

  const triggers = [
    'Show session ending toast',
    'Show device signed out toast',
    'Show already signed out toast',
    'Show signed out others toast',
    'Show password saved toast',
  ];
  const failures: string[] = [];
  for (const trigger of triggers) {
    await page.getByRole('button', { name: trigger }).click();
    await settle(page);
    const toastRight = await page.evaluate<number>(
      `(() => {
        const layer = document.querySelector('[data-ui="s-toast-layer"]');
        const parts = layer ? [...layer.querySelectorAll('*')] : [];
        return Math.max(0, ...parts.map((part) => part.getBoundingClientRect().right));
      })()`,
    );
    const reading = await page.evaluate<Reading>(READ);
    if (toastRight > reading.innerWidth || reading.scrollWidth > reading.innerWidth) {
      failures.push(
        `${trigger}: toast right ${String(Math.round(toastRight))}, scrollWidth ${String(reading.scrollWidth)}, window ${String(reading.innerWidth)} (${reading.offenders.join('; ') || 'no element found'})`,
      );
    }
    // Close it, so the next trigger is not under the toast (on a phone the layer sits over the page).
    const dismiss = page.locator('[data-ui="s-toast-layer"]').getByRole('button', { name: 'Dismiss' });
    await dismiss.first().click();
    await expect(dismiss).toHaveCount(0);
  }
  expect(failures).toEqual([]);
});

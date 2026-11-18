// Cookie consent journeys (PRD §14, ANL-01 to ANL-04, ANL-07, D-18, D-30, D-31; UI-SPEC CB1, CS1, CS2, M1), in every project.
// Each test starts as a first-time visitor (no saved choice), so the bar shows. The checks read the real browser: the cookie
// jar, local and session storage, and every request the context makes.
//   - Before a choice: no cookie, no Google request, no speed reader chunk, no page view yet (it is held for the choice).
//   - Accept All sets the consent cookie (readable) and the visitor id (HttpOnly, analytics path) and loads the speed reader.
//   - Reject All sets no visitor id and loads no speed reader; the held page view leaves without one.
//   - Cookie Settings from the bar opens unticked; from the footer it shows the saved choice.
//   - Clear removes the visitor id and storage, leaves a stats 0 and map 0 choice, and the bar stays away.
//   - At 320px the Clear dialog fits; on Contact the phone Contact bar waits for the choice; "Always show maps?" sticks.
import type { BrowserContext, Cookie, Page, Request } from '@playwright/test';
import { expect, expectNoAxeViolations, test } from './fixtures.ts';
import { NO_SIDEWAYS_SCROLL, press } from './helpers.ts';
import { withSiteContentLock } from './site-content-lock.ts';
import { seedDemoSiteContent } from './testing-api.ts';

test.use({ consent: 'none' });
// WebKit and the phones are slow to start the lazy chunks; the Contact tests also wait for the site content lock (up to 6 minutes).
test.describe.configure({ timeout: 480_000 });

const CONSENT_COOKIE = '__Host-csps_consent';
const VISITOR_COOKIE = '__Secure-csps_vid';
const ANALYTICS = '/api/v1/analytics/';
const CONSENT_API = '/api/v1/analytics/consent';
const CLEAR_API = '/api/v1/analytics/clear';
const SPEED_READER = /\/assets\/speedReport-[\w-]+\.js$/;
const MAP_EMBED = 'https://www.google.com/maps/embed**';
const MAP_STUB =
  '<!doctype html><html lang="en"><head><title>Map stub</title></head><body><p>Map stub</p></body></html>';
/** A server-confirmed choice: stats and map as 0, 1 or - (unchosen), no pending marker. */
const choiceValue = (stats: '0' | '1' | '-', map: '0' | '1'): RegExp =>
  new RegExp(`^1_[0-9a-f]{32}_\\d+\\.\\d+_${stats}_${map}_\\d{8}$`);

const STORAGE_SIZE = 'localStorage.length + sessionStorage.length';
const PUT_PROBES = `(() => { localStorage.setItem('e2e-probe', '1'); sessionStorage.setItem('e2e-probe', '1'); return true; })()`;

/** Every request the context makes, from now on. */
function recordRequests(context: BrowserContext): Request[] {
  const seen: Request[] = [];
  context.on('request', (request) => {
    seen.push(request);
  });
  return seen;
}

const pathOf = (request: Request): string => new URL(request.url()).pathname;
const isGoogle = (request: Request): boolean => /(^|\.)google\.com$/.test(new URL(request.url()).hostname);
const isSpeedReader = (request: Request): boolean => SPEED_READER.test(pathOf(request));

async function cookieNamed(context: BrowserContext, name: string): Promise<Cookie | undefined> {
  return (await context.cookies()).find((cookie) => cookie.name === name);
}

const bar = (page: Page) => page.getByRole('region', { name: 'Cookie choices' });
const settingsWindow = (page: Page) => page.getByRole('dialog', { name: 'Cookie Settings' });
const clearDialog = (page: Page) => page.getByRole('dialog', { name: 'Clear your cookies and data?' });
const footerSettings = (page: Page) => page.getByRole('contentinfo').getByRole('button', { name: 'Cookie Settings' });

/** Opens a public page and waits until it has stopped loading, so "nothing happened" means nothing. */
async function openQuietly(page: Page, path: string): Promise<void> {
  await page.goto(path);
  await expect(page.locator('h1')).toBeVisible();
  await page.waitForLoadState('networkidle');
}

/** Presses a button that sends a choice and waits for the server to confirm it (it sets the cookies). */
async function chooseAndWait(page: Page, press: () => Promise<void>, api = CONSENT_API): Promise<void> {
  const answer = page.waitForResponse((response) => response.url().endsWith(api) && response.status() === 200);
  await press();
  await answer;
}

test('@consent a first visit sets no cookie, calls no Google, loads no speed reader and holds the page view until a choice', async ({
  page,
  context,
}) => {
  const requests = recordRequests(context);
  await openQuietly(page, '/');
  await expect(bar(page)).toBeVisible();

  expect(await context.cookies(), 'no cookie before a choice').toEqual([]);
  expect(requests.filter(isGoogle).map((request) => request.url())).toEqual([]);
  expect(requests.filter(isSpeedReader).map((request) => request.url())).toEqual([]);
  expect(requests.filter((request) => pathOf(request).startsWith(ANALYTICS)).map(pathOf), 'nothing sent yet').toEqual(
    [],
  );

  const view = page.waitForRequest((request) => pathOf(request) === '/api/v1/analytics/page-views');
  await chooseAndWait(page, () => bar(page).getByRole('button', { name: 'Reject All' }).click());
  const sent = await view;
  // The one held view leaves after the choice, with the path only and no visitor id in the jar to carry.
  expect(sent.postDataJSON()).toEqual({ path: '/' });
  expect(await cookieNamed(context, VISITOR_COOKIE)).toBeUndefined();
  expect(
    requests.filter((request) => pathOf(request) === '/api/v1/analytics/page-views'),
    'the landing view is sent once',
  ).toHaveLength(1);
});

test('@consent Accept All saves both, sets the visitor id with its attributes, loads the speed reader and the bar stays away', async ({
  page,
  context,
  browserName,
}) => {
  await openQuietly(page, '/');
  const reader = page.waitForRequest(isSpeedReader);
  await chooseAndWait(page, () => bar(page).getByRole('button', { name: 'Accept All' }).click());
  await reader;
  await expect(bar(page)).toHaveCount(0);
  await expect(page.locator('main#main')).toBeFocused();

  const consent = await cookieNamed(context, CONSENT_COOKIE);
  expect(consent?.value).toMatch(choiceValue('1', '1'));
  expect(consent).toMatchObject({ httpOnly: false, secure: true, path: '/' });
  const visitor = await cookieNamed(context, VISITOR_COOKIE);
  expect(visitor).toMatchObject({ httpOnly: true, secure: true, path: '/api/v1/analytics' });
  expect(visitor?.value).toMatch(/^[A-Za-z0-9_-]{43}$/);
  // Playwright's WebKit on Windows reports SameSite None for every cookie (see auth-cookies.spec.ts).
  if (browserName !== 'webkit') {
    expect(consent?.sameSite).toBe('Lax');
    expect(visitor?.sameSite).toBe('Strict');
  }

  await openQuietly(page, '/products');
  await expect(bar(page)).toHaveCount(0);
});

test('@consent Reject All saves both off, sets no visitor id and never loads the speed reader', async ({
  page,
  context,
}) => {
  const requests = recordRequests(context);
  await openQuietly(page, '/');
  await chooseAndWait(page, () => bar(page).getByRole('button', { name: 'Reject All' }).click());
  await expect(bar(page)).toHaveCount(0);

  await openQuietly(page, '/products');
  await expect(bar(page)).toHaveCount(0);
  expect((await cookieNamed(context, CONSENT_COOKIE))?.value).toMatch(choiceValue('0', '0'));
  expect(await cookieNamed(context, VISITOR_COOKIE)).toBeUndefined();
  expect(requests.filter(isSpeedReader).map((request) => request.url())).toEqual([]);
  expect(requests.filter(isGoogle).map((request) => request.url())).toEqual([]);
});

test('@consent Cookie Settings from the bar opens unticked and saves Visitor stats alone; from the footer it shows that choice', async ({
  page,
  context,
}) => {
  await openQuietly(page, '/');
  await bar(page).getByRole('button', { name: 'Cookie Settings' }).click();
  const settings = settingsWindow(page);
  await expect(settings).toBeVisible();
  await expect(settings.getByRole('checkbox', { name: 'Visitor stats' })).not.toBeChecked();
  await expect(settings.getByRole('checkbox', { name: 'Google map' })).not.toBeChecked();

  await settings.getByRole('checkbox', { name: 'Visitor stats' }).check();
  await chooseAndWait(page, () => settings.getByRole('button', { name: 'Save Choices' }).click());
  await expect(settings).toHaveCount(0);
  await expect(bar(page)).toHaveCount(0);
  expect((await cookieNamed(context, CONSENT_COOKIE))?.value).toMatch(choiceValue('1', '0'));
  expect(await cookieNamed(context, VISITOR_COOKIE)).toMatchObject({ httpOnly: true, path: '/api/v1/analytics' });

  await openQuietly(page, '/cookies');
  await expect(bar(page)).toHaveCount(0);
  await footerSettings(page).click();
  await expect(settingsWindow(page).getByRole('checkbox', { name: 'Visitor stats' })).toBeChecked();
  await expect(settingsWindow(page).getByRole('checkbox', { name: 'Google map' })).not.toBeChecked();
  await expect(settingsWindow(page).getByText(/^You chose on /)).toBeVisible();
  await expectNoAxeViolations(page);
});

test('@consent Clear my cookies & data removes the visitor id and storage, leaves both off, and the bar stays away', async ({
  page,
  context,
}) => {
  await openQuietly(page, '/');
  await chooseAndWait(page, () => bar(page).getByRole('button', { name: 'Accept All' }).click());
  await openQuietly(page, '/products');
  await openQuietly(page, '/privacy');
  expect(await cookieNamed(context, VISITOR_COOKIE)).toBeDefined();
  await page.evaluate<boolean>(PUT_PROBES);
  expect(await page.evaluate<number>(STORAGE_SIZE)).toBeGreaterThan(0);

  await footerSettings(page).click();
  const settings = settingsWindow(page);
  await settings.getByRole('button', { name: 'Clear My Cookies & Data' }).click();
  const dialog = clearDialog(page);
  await expect(dialog.getByRole('button', { name: 'Keep My Data' })).toBeFocused();
  await chooseAndWait(page, () => dialog.getByRole('button', { name: 'Clear My Data' }).click(), CLEAR_API);

  await expect(dialog).toHaveCount(0);
  await expect(
    settings.getByText(
      'Done. The optional cookies and your visit records are deleted. Visitor stats and the map are now off.',
    ),
  ).toBeVisible();
  await expect(settings.getByRole('button', { name: 'Clear My Cookies & Data' })).toBeFocused();
  await expect(settings.getByRole('checkbox', { name: 'Visitor stats' })).not.toBeChecked();
  await expect(settings.getByRole('checkbox', { name: 'Google map' })).not.toBeChecked();
  expect(await cookieNamed(context, VISITOR_COOKIE)).toBeUndefined();
  expect(await page.evaluate<number>(STORAGE_SIZE)).toBe(0);
  expect((await cookieNamed(context, CONSENT_COOKIE))?.value).toMatch(choiceValue('0', '0'));

  await page.keyboard.press('Escape');
  await expect(settings).toHaveCount(0);
  // A /terms view is counted for everyone, and the Visitor Stats spec reads that row, so it is opened under the site content lock.
  await withSiteContentLock(() => openQuietly(page, '/terms'));
  await expect(bar(page)).toHaveCount(0);
  expect(await cookieNamed(context, VISITOR_COOKIE)).toBeUndefined();
});

/** How the Clear dialog sits at a narrow width (read in the page). */
interface DialogFit {
  readonly left: number;
  readonly right: number;
  readonly messageFits: boolean;
}

const READ_DIALOG_FIT = `(() => {
  const dialog = [...document.querySelectorAll('[role="dialog"]')].find((element) => element.textContent.includes('Clear your cookies and data?'));
  const box = dialog.getBoundingClientRect();
  const message = [...dialog.querySelectorAll('p')].find((element) => element.textContent.includes("can't be undone"));
  return { left: box.left, right: box.right, messageFits: message !== undefined && message.scrollWidth <= message.clientWidth };
})()`;

const ANIMATIONS_DONE = `(async () => {
  const running = document.getAnimations().filter((animation) => animation.effect?.getComputedTiming().iterations !== Infinity);
  await Promise.allSettled(running.map((animation) => animation.finished));
  return true;
})()`;

test('@consent at 320px the Clear dialog text wraps, its two buttons stack at 44px each and nothing scrolls sideways', async ({
  page,
}) => {
  await page.setViewportSize({ width: 320, height: 640 });
  await openQuietly(page, '/');
  await bar(page).getByRole('button', { name: 'Cookie Settings' }).click();
  // From the keyboard: Safari does not focus a button on a click, and the focus return is checked at the end.
  await press(page, settingsWindow(page).getByRole('button', { name: 'Clear My Cookies & Data' }));
  const dialog = clearDialog(page);
  const keep = dialog.getByRole('button', { name: 'Keep My Data' });
  const clear = dialog.getByRole('button', { name: 'Clear My Data' });
  await expect(keep).toBeFocused();
  await expect(clear).toBeVisible();
  // The dialog rises in from scale(0.98), so it is measured once its entry animation is over.
  await page.evaluate<boolean>(ANIMATIONS_DONE);

  const fit = await page.evaluate<DialogFit>(READ_DIALOG_FIT);
  expect(fit.left).toBeGreaterThanOrEqual(0);
  expect(fit.right).toBeLessThanOrEqual(320);
  expect(fit.messageFits, 'the message wraps inside the dialog').toBe(true);
  const keepBox = await keep.boundingBox();
  const clearBox = await clear.boundingBox();
  expect(keepBox?.height ?? 0).toBeGreaterThanOrEqual(44);
  expect(clearBox?.height ?? 0).toBeGreaterThanOrEqual(44);
  const [upper, lower] = (keepBox?.y ?? 0) < (clearBox?.y ?? 0) ? [keepBox, clearBox] : [clearBox, keepBox];
  expect(lower?.y ?? 0, 'one button sits under the other').toBeGreaterThanOrEqual(
    (upper?.y ?? 0) + (upper?.height ?? 0) - 1,
  );
  expect(await page.evaluate<boolean>(NO_SIDEWAYS_SCROLL)).toBe(true);
  await expectNoAxeViolations(page);

  await keep.click();
  await expect(dialog).toHaveCount(0);
  await expect(settingsWindow(page).getByRole('button', { name: 'Clear My Cookies & Data' })).toBeFocused();
});

test('@consent D-30 on Contact at 390px the Messenger and Call bar waits while the cookie bar shows and returns after a choice', async ({
  page,
  request,
}) => {
  await withSiteContentLock(async () => {
    await seedDemoSiteContent(request);
    await page.setViewportSize({ width: 390, height: 844 });
    await openQuietly(page, '/contact');
    await expect(bar(page)).toBeVisible();
    await expect(page.locator('[data-contact-bar]')).toHaveCount(0);

    await chooseAndWait(page, () => bar(page).getByRole('button', { name: 'Reject All' }).click());
    await expect(bar(page)).toHaveCount(0);
    const contactBar = page.locator('[data-contact-bar]');
    await expect(contactBar.getByRole('link', { name: 'Messenger' })).toHaveAttribute('href', 'https://m.me/cspsdemo');
    await expect(contactBar.getByRole('link', { name: 'Call us' })).toBeVisible();
  });
});

test('@consent D-18 Show Map then "Always show maps?" saves map consent, and a reload shows the map at once', async ({
  page,
  context,
  request,
}) => {
  await withSiteContentLock(async () => {
    await seedDemoSiteContent(request);
    const googleRequests: string[] = [];
    await context.route(MAP_EMBED, (route) => {
      googleRequests.push(route.request().url());
      return route.fulfill({ contentType: 'text/html', body: MAP_STUB });
    });
    await openQuietly(page, '/contact');
    await expect(page.locator('iframe')).toHaveCount(0);
    expect(googleRequests).toEqual([]);

    await page.getByRole('button', { name: 'Show Map' }).click();
    await expect(page.frameLocator('iframe').getByText('Map stub')).toBeVisible();
    await chooseAndWait(page, () => page.getByRole('button', { name: 'Always show maps?' }).click());
    await expect(
      page.getByText('Maps will show right away from now on. You can change this in Cookie Settings.'),
    ).toBeVisible();
    // Only the map part is saved; Visitor stats stays unchosen, so the bar still asks.
    expect((await cookieNamed(context, CONSENT_COOKIE))?.value).toMatch(choiceValue('-', '1'));
    await expect(bar(page)).toBeVisible();

    await page.reload();
    await expect(page.locator('h1')).toBeVisible();
    // The frame is there with no tap. It is loading="lazy", and WebKit loads it only near the window, so it is scrolled to.
    const frame = page.locator('iframe[title^="Map of "]');
    await expect(frame).toHaveAttribute('src', /^https:\/\/www\.google\.com\/maps\/embed/);
    await expect(page.getByRole('button', { name: 'Show Map' })).toHaveCount(0);
    await frame.scrollIntoViewIfNeeded();
    await expect(page.frameLocator('iframe').getByText('Map stub')).toBeVisible();
    expect(googleRequests).toHaveLength(2);
    expect(await cookieNamed(context, VISITOR_COOKIE)).toBeUndefined();
  });
});

// The visual-suite guard (WEB-02, D-33; the same contract as web/e2e/fixtures.ts, for route-served pages). Import
// `test` and `expect` from here in every visual spec, so a parity page fails its test on:
//   - any console message of type error or warning,
//   - any uncaught page error,
//   - any Content-Security-Policy violation (reported through a Playwright binding, so it survives navigation, L-23),
//   - any response with status 400 or higher, and any request that never completed (an aborted off-origin load).
// expectCases(page) fails a page whose ?group/?case filter selected no scenario, so a mistyped filter never passes.
// The `appPage` fixture is a second guarded page in the same context (the implementation side of a parity comparison).
// Take every screenshot through screenshotLocator / screenshotPage: in WebKit, Playwright's screenshotter adds one
// <style> the CSP blocks, and the guard discounts exactly that finding per screenshot (webkit-style-sync.ts).
import { test as base, expect } from '@playwright/test';
import type { Locator, LocatorScreenshotOptions, Page, PageScreenshotOptions } from '@playwright/test';
import { withoutScreenshotStyleSync } from './webkit-style-sync.ts';

export { expect };

/** One blocked load or execution, as reported by the page's `securitypolicyviolation` event. */
export interface CspViolation {
  readonly directive: string;
  readonly blockedURI: string;
}

/** Everything the guard recorded since the test started. */
export interface VisualRecord {
  readonly console: readonly string[];
  readonly pageErrors: readonly string[];
  readonly cspViolations: readonly CspViolation[];
  readonly failedRequests: readonly string[];
}

export interface VisualGuard {
  /** Returns the record so far without clearing it. */
  peek(): Promise<VisualRecord>;
}

/** The page-side binding name. Kept unusual so no spec or app code can collide with it. */
export const CSP_BINDING = '__cspsVisualCspViolation';

// Runs before any page script in every document (init scripts run under the strict CSP in all three engines). The
// listener reports through the binding, so a violation is kept even when the page navigates away.
const cspListener = `document.addEventListener('securitypolicyviolation', (event) => {
  window.${CSP_BINDING}({ directive: event.effectiveDirective || event.violatedDirective, blockedURI: event.blockedURI });
}, true);`;

function isCspViolation(value: unknown): value is CspViolation {
  if (typeof value !== 'object' || value === null) {
    return false;
  }
  const candidate = value as Record<string, unknown>;
  return typeof candidate.directive === 'string' && typeof candidate.blockedURI === 'string';
}

/** One line per finding, in a fixed order: console, page errors, CSP, requests. */
export function listFindings(record: VisualRecord): string[] {
  return [
    ...record.console,
    ...record.pageErrors.map((message) => `pageerror: ${message}`),
    ...record.cspViolations.map((violation) => `csp: ${violation.directive} blocked ${violation.blockedURI}`),
    ...record.failedRequests.map((request) => `request: ${request}`),
  ];
}

interface PageWatch {
  /** Delivers pending binding calls, then returns the record so far. */
  readonly peek: () => Promise<VisualRecord>;
  /** Throws when the record holds any finding; `label` names the page in the message. */
  readonly assertClean: (label: string) => Promise<void>;
  /** Counts one screenshot this suite took (see screenshotLocator / screenshotPage). */
  readonly noteScreenshot: () => void;
}

/** The watch of every guarded page, so the screenshot helpers can count their own screenshots. */
const WATCHES = new WeakMap<Page, PageWatch>();

/** Starts recording console messages, page errors, CSP violations and failed requests for one page. */
async function watchPage(page: Page): Promise<PageWatch> {
  const consoleMessages: string[] = [];
  const pageErrors: string[] = [];
  const cspViolations: CspViolation[] = [];
  const failedRequests: string[] = [];

  page.on('console', (message) => {
    const type = message.type();
    if (type !== 'error' && type !== 'warning') {
      return;
    }
    const { url, lineNumber } = message.location();
    consoleMessages.push(`console.${type}: ${message.text()}${url ? ` (${url}:${String(lineNumber)})` : ''}`);
  });
  page.on('pageerror', (error) => {
    pageErrors.push(error.message);
  });
  page.on('response', (response) => {
    if (response.status() >= 400) {
      failedRequests.push(`${String(response.status())} ${response.request().method()} ${response.url()}`);
    }
  });
  page.on('requestfailed', (request) => {
    failedRequests.push(`failed ${request.method()} ${request.url()} (${request.failure()?.errorText ?? 'unknown'})`);
  });
  await page.exposeBinding(CSP_BINDING, (_source, violation: unknown) => {
    cspViolations.push(
      isCspViolation(violation) ? violation : { directive: 'unknown', blockedURI: JSON.stringify(violation) },
    );
  });
  await page.addInitScript({ content: cspListener });

  // WebKit only: each screenshot taken through the helpers below adds one known Playwright finding (webkit-style-sync.ts).
  const webkit = page.context().browser()?.browserType().name() === 'webkit';
  let screenshots = 0;

  // A round trip to the page delivers any binding call the page made before it. A closed page has nothing left.
  const settle = async (): Promise<void> => {
    if (!page.isClosed()) {
      await page.evaluate('0').catch(() => undefined);
    }
  };
  const snapshot = (): VisualRecord =>
    withoutScreenshotStyleSync(
      {
        console: [...consoleMessages],
        pageErrors: [...pageErrors],
        cspViolations: [...cspViolations],
        failedRequests: [...failedRequests],
      },
      webkit ? screenshots : 0,
    );

  const watch: PageWatch = {
    peek: async () => {
      await settle();
      return snapshot();
    },
    assertClean: async (label) => {
      await settle();
      const findings = listFindings(snapshot());
      if (findings.length > 0) {
        throw new Error(`The ${label} reported ${String(findings.length)} problem(s):\n${findings.join('\n')}`);
      }
    },
    noteScreenshot: () => {
      screenshots += 1;
    },
  };
  WATCHES.set(page, watch);
  return watch;
}

/**
 * Takes a locator screenshot on a guarded page. Use it (and screenshotPage) for every screenshot in a visual spec: in
 * WebKit the guard then discounts the one blocked `<style>` Playwright's screenshotter adds (webkit-style-sync.ts).
 */
export async function screenshotLocator(locator: Locator, options: LocatorScreenshotOptions = {}): Promise<Buffer> {
  WATCHES.get(locator.page())?.noteScreenshot();
  return locator.screenshot(options);
}

/** Takes a viewport screenshot on a guarded page (see screenshotLocator). */
export async function screenshotPage(page: Page, options: PageScreenshotOptions = {}): Promise<Buffer> {
  WATCHES.get(page)?.noteScreenshot();
  return page.screenshot(options);
}

export const test = base.extend<{ guard: VisualGuard; appPage: Page }>({
  guard: [
    // The callback is named `provide`, not `use`, so react-hooks/rules-of-hooks does not misfire (L-23).
    async ({ page }, provide) => {
      const watch = await watchPage(page);
      await provide({ peek: watch.peek });
      await watch.assertClean('page');
    },
    { auto: true },
  ],
  // A second page in the same browser context (so the same viewport, reduced-motion and touch settings), for the
  // implementation side of a parity comparison (plan 02-14). It is guarded exactly like `page`.
  appPage: async ({ context }, provide) => {
    const appPage = await context.newPage();
    const watch = await watchPage(appPage);
    await provide(appPage);
    await watch.assertClean('implementation page');
    await appPage.close();
  },
});

/** The text expectCases throws for a page whose filter selected nothing. */
export const EMPTY_SELECTION_MESSAGE =
  'The parity page selected no scenario; check the ?theme, ?group and ?case filter.';

/**
 * Waits until the page rendered its cases (or its empty marker), then returns the number of `[data-case]` frames.
 * Throws EMPTY_SELECTION_MESSAGE when the page shows the `data-parity-empty` marker.
 */
export async function expectCases(page: Page): Promise<number> {
  await expect(page.locator('[data-case], [data-parity-empty]').first()).toBeAttached();
  if ((await page.locator('[data-parity-empty]').count()) > 0) {
    throw new Error(EMPTY_SELECTION_MESSAGE);
  }
  return page.locator('[data-case]').count();
}

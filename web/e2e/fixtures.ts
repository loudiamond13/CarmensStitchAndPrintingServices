// Shared E2E fixture (QUAL-04, A11Y-01, research Pattern 11). Import `test` and `expect` from here, never from
// @playwright/test, so every E2E test fails on:
//   - any console message of type error or warning,
//   - any uncaught page error,
//   - any Content-Security-Policy violation (reported through a Playwright binding, so it survives navigation, L-23),
//   - any same-origin response with status 400 or higher that the test did not declare with guard.expectStatus,
//   - any same-origin request that failed at network level (reset, refused, DNS: no response at all) that the test did
//     not declare with guard.expectFailure; a cancellation (a navigation or an AbortController) is not a failure.
// Every page of the test's browser context is guarded, not only the fixture `page` (TOOL-WR-14).
// expectNoAxeViolations(page) adds the page-level axe check with the same tags as the component tests.
import { AxeBuilder } from '@axe-core/playwright';
import { test as base, expect } from '@playwright/test';
import type { Page } from '@playwright/test';
import { AXE_TAGS } from '../src/test/axeTags.ts';

export { expect };

/** One blocked load or execution, as reported by the page's `securitypolicyviolation` event. */
export interface CspViolation {
  readonly directive: string;
  readonly blockedURI: string;
}

/** Everything the guard recorded since the test started or since the last `take()`. */
export interface GuardRecord {
  readonly console: readonly string[];
  readonly pageErrors: readonly string[];
  readonly cspViolations: readonly CspViolation[];
  readonly failedResponses: readonly string[];
}

export interface Guard {
  /**
   * Declares that a same-origin response whose URL contains `urlPart` may answer `status` (400 or higher) in this test,
   * including the browser's own "Failed to load resource" console line for it. Every other failed response is a finding.
   */
  expectStatus(urlPart: string, status: number): void;
  /**
   * Declares that a same-origin request whose URL contains `urlPart` may fail at network level (no response) in this
   * test, including the browser's own "Failed to load resource" console line for it.
   */
  expectFailure(urlPart: string): void;
  /** Returns the record so far without clearing it. */
  peek(): Promise<GuardRecord>;
  /** Returns and clears the record. Only the fixture self-tests need it: they provoke a finding on purpose. */
  take(): Promise<GuardRecord>;
}

/** The page-side binding name. Kept unusual so no app code can collide with it. */
export const CSP_BINDING = '__cspsE2eCspViolation';

// Runs before any page script in every document (init scripts run under the strict CSP in all three engines, research
// Pitfall 8). The listener reports through the binding, so a violation is kept even when the page navigates away.
const cspListener = `document.addEventListener('securitypolicyviolation', (event) => {
  window.${CSP_BINDING}({ directive: event.effectiveDirective || event.violatedDirective, blockedURI: event.blockedURI });
}, true);`;

// The console line Chromium and WebKit write for a failed load (Firefox writes none).
const LOAD_FAILURE = /^Failed to load resource: the server responded with a status of (\d{3})\b/;
// Their console line for a load that got no response at all (net::ERR_*, "The network connection was lost.", ...).
const NETWORK_FAILURE = /^Failed to load resource\b/;
// WebKit's own warning for a <link rel="modulepreload"> that nothing "used" within a few seconds of the window's load
// event. Vite adds such links when a route's lazy chunk loads, and the chunk then comes from the module map, which WebKit
// does not count as a use. So any client-side navigation to a chunk not yet loaded, more than about 3 seconds after the
// page loaded (typing a password and a code takes that long), makes WebKit warn about a chunk the page did use. It is
// matched exactly: our own /assets/*.js chunk and WebKit's wording, nothing else.
const UNUSED_PRELOAD =
  /^The resource https?:\/\/[^\s/]+\/assets\/[\w.-]+\.js was preloaded using link preload but not used within a few seconds from the window's load event\. Please make sure it wasn't preloaded for nothing\.$/;
// How each engine names a cancelled request: Chromium net::ERR_ABORTED, Firefox NS_BINDING_ABORTED, WebKit cancelled.
const CANCELLED = /ERR_ABORTED|NS_BINDING_ABORTED|cancel/i;

function isCspViolation(value: unknown): value is CspViolation {
  if (typeof value !== 'object' || value === null) {
    return false;
  }
  const candidate = value as Record<string, unknown>;
  return typeof candidate.directive === 'string' && typeof candidate.blockedURI === 'string';
}

/** One line per finding, in a fixed order: console, page errors, CSP, responses. */
export function listFindings(record: GuardRecord): string[] {
  return [
    ...record.console,
    ...record.pageErrors.map((message) => `pageerror: ${message}`),
    ...record.cspViolations.map((violation) => `csp: ${violation.directive} blocked ${violation.blockedURI}`),
    ...record.failedResponses.map((response) => `response: ${response}`),
  ];
}

/** The guard's end-of-test check: throws with every finding when the record is not empty. */
export function assertNoFindings(record: GuardRecord): void {
  const findings = listFindings(record);
  if (findings.length > 0) {
    throw new Error(`The page reported ${String(findings.length)} problem(s):\n${findings.join('\n')}`);
  }
}

export const test = base.extend<{ guard: Guard }>({
  guard: [
    // The callback is named `provide`, not `use`, so react-hooks/rules-of-hooks does not misfire (L-23).
    async ({ page, baseURL }, provide) => {
      const context = page.context();
      const origin = new URL(baseURL ?? 'https://localhost:5199').origin;
      const expected: { urlPart: string; status: number }[] = [];
      const expectedFailures: string[] = [];
      let consoleMessages: string[] = [];
      let pageErrors: string[] = [];
      let cspViolations: CspViolation[] = [];
      let failedResponses: string[] = [];

      const isDeclared = (url: string, status: number): boolean =>
        URL.canParse(url) &&
        new URL(url).origin === origin &&
        expected.some((entry) => entry.status === status && url.includes(entry.urlPart));

      const isSameOrigin = (url: string): boolean => URL.canParse(url) && new URL(url).origin === origin;
      const isDeclaredFailure = (url: string): boolean =>
        isSameOrigin(url) && expectedFailures.some((urlPart) => url.includes(urlPart));

      /** Attaches the console, page error, response and network-failure listeners to one page of the context. */
      const watch = (target: Page): void => {
        target.on('console', (message) => {
          const type = message.type();
          if (type !== 'error' && type !== 'warning') {
            return;
          }
          const text = message.text();
          const { url, lineNumber } = message.location();
          // Chromium and WebKit also log every failed load as a console error located at the resource URL. A status or
          // a network failure the test declared is not a finding there either.
          const loadFailure = LOAD_FAILURE.exec(text);
          if (loadFailure?.[1] !== undefined && isDeclared(url, Number(loadFailure[1]))) {
            return;
          }
          if (loadFailure === null && NETWORK_FAILURE.test(text) && isDeclaredFailure(url)) {
            return;
          }
          if (type === 'warning' && UNUSED_PRELOAD.test(text)) {
            return;
          }
          consoleMessages.push(`console.${type}: ${text}${url ? ` (${url}:${String(lineNumber)})` : ''}`);
        });
        target.on('pageerror', (error) => {
          pageErrors.push(error.message);
        });
        target.on('response', (response) => {
          const status = response.status();
          const url = response.url();
          if (status < 400 || new URL(url).origin !== origin || isDeclared(url, status)) {
            return;
          }
          failedResponses.push(`${String(status)} ${response.request().method()} ${url}`);
        });
        // TOOL-WR-14: a request with no response at all (reset, refused) never reaches the response listener.
        target.on('requestfailed', (request) => {
          const url = request.url();
          const reason = request.failure()?.errorText ?? 'unknown';
          if (!isSameOrigin(url) || CANCELLED.test(reason) || isDeclaredFailure(url)) {
            return;
          }
          failedResponses.push(`failed ${request.method()} ${url} (${reason})`);
        });
      };
      watch(page);
      context.on('page', watch);
      // Context-wide, so every page of the test (popups, context.newPage()) reports its CSP violations too.
      await context.exposeBinding(CSP_BINDING, (_source, violation: unknown) => {
        cspViolations.push(
          isCspViolation(violation) ? violation : { directive: 'unknown', blockedURI: JSON.stringify(violation) },
        );
      });
      await context.addInitScript({ content: cspListener });

      // A round trip to each open page delivers any binding call the page made before it, so a violation raised during
      // the last load is recorded before the guard reads it. A closed page has nothing left to deliver.
      const settle = async (): Promise<void> => {
        for (const open of context.pages()) {
          if (!open.isClosed()) {
            await open.evaluate('0').catch(() => undefined);
          }
        }
      };

      const snapshot = (): GuardRecord => ({
        console: [...consoleMessages],
        pageErrors: [...pageErrors],
        cspViolations: [...cspViolations],
        failedResponses: [...failedResponses],
      });

      await provide({
        expectStatus: (urlPart, status) => {
          expected.push({ urlPart, status });
        },
        expectFailure: (urlPart) => {
          expectedFailures.push(urlPart);
        },
        peek: async () => {
          await settle();
          return snapshot();
        },
        take: async () => {
          await settle();
          const record = snapshot();
          consoleMessages = [];
          pageErrors = [];
          cspViolations = [];
          failedResponses = [];
          return record;
        },
      });

      await settle();
      assertNoFindings(snapshot());
    },
    { auto: true },
  ],
});

/**
 * Runs axe over the whole page with the A11Y-01 tags (src/test/axeTags.ts, shared with the component tests). The
 * contrast rule stays on here, unlike in jsdom. Rejects with one `<rule id>: <targets>` line per violation, sorted.
 */
export async function expectNoAxeViolations(page: Page): Promise<void> {
  const results = await new AxeBuilder({ page }).withTags([...AXE_TAGS]).analyze();
  const lines = results.violations
    .map((violation) => ({
      id: violation.id,
      targets: violation.nodes.map((node) => node.target.join(' ')).sort((a, b) => a.localeCompare(b)),
    }))
    .sort((a, b) => a.id.localeCompare(b.id) || (a.targets[0] ?? '').localeCompare(b.targets[0] ?? ''))
    .map((violation) => `${violation.id}: ${violation.targets.join(', ')}`);
  if (lines.length > 0) {
    throw new Error(`axe found ${String(lines.length)} violation(s):\n${lines.join('\n')}`);
  }
}

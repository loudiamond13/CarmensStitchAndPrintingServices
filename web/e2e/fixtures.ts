// Shared E2E fixture (QUAL-04, A11Y-01, research Pattern 11). Import `test` and `expect` from here, never from
// @playwright/test, so every E2E test fails on:
//   - any console message of type error or warning,
//   - any uncaught page error,
//   - any Content-Security-Policy violation (reported through a Playwright binding, so it survives navigation, L-23),
//   - any same-origin response with status 400 or higher that the test did not declare with guard.expectStatus,
//   - any same-origin request that failed at network level (reset, refused, DNS: no response at all) that the test did
//     not declare with guard.expectFailure; a cancellation (a navigation or an AbortController) is not a failure.
// Every page of the test's browser context is guarded, not only the fixture `page` (TOOL-WR-14).
// expectNoAxeViolations(page) adds the page-level axe check with the same tags as the component tests. A target-size
// finding that only a fixed or sticky bar causes is re-checked after the target is scrolled clear of the bar (D-71).
import { AxeBuilder } from '@axe-core/playwright';
import { test as base, expect } from '@playwright/test';
import type { Page } from '@playwright/test';
import type { CheckResult, NodeResult, Result } from 'axe-core';
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
// Firefox's warning for the page's one font <link rel="preload"> (the Archivo Variable woff2) when the page stays open for
// more than a few seconds: it reports the preload as unused although the page renders with the font (the fonts spec proves
// the font loads once, same origin). Any long Firefox journey on one document meets it (plans 05-08, 05-18, 05-28, 05-33).
// It is matched exactly: our own /assets/archivo-latin-wght-normal-*.woff2 and Firefox's wording, nothing else.
const UNUSED_FONT_PRELOAD =
  /^\[JavaScript Warning: "The resource at “https?:\/\/[^\s/]+\/assets\/archivo-latin-wght-normal-[\w-]+\.woff2” preloaded with link preload was not used within a few seconds\. Make sure all attributes of the preload tag are set correctly\."/;
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
          if (type === 'warning' && (UNUSED_PRELOAD.test(text) || UNUSED_FONT_PRELOAD.test(text))) {
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
 * The axe run every e2e check uses: the A11Y-01 tags (src/test/axeTags.ts), every rule on every node, full detail for
 * violations only. The default run gives every passing node a unique selector before it trims anything, which took about
 * 25 s per check in WebKit on a picker of 2,300 options (debug session expenses-add-save-slow). Legacy mode runs axe in
 * the page, where passes are trimmed first. It skips cross-origin frames; the app has none.
 */
export function pageAxe(page: Page): AxeBuilder {
  // options() replaces every option set before it, so it goes before withTags.
  return new AxeBuilder({ page })
    .options({ resultTypes: ['violations'] })
    .withTags([...AXE_TAGS])
    .setLegacyMode();
}

/** The scroll offsets the D-71 re-check puts back: the window, and each scrolled ancestor of the target by depth. */
interface ScrollState {
  readonly x: number;
  readonly y: number;
  /** [depth above the target, scrollTop, scrollLeft] */
  readonly ancestors: readonly (readonly [number, number, number])[];
}

/** A selector axe gave as one plain string (no frame or shadow path), or null. */
function plainSelector(target: NodeResult['target']): string | null {
  const [only] = target;
  return target.length === 1 && typeof only === 'string' ? only : null;
}

/** True when the check is target-size's "partially obscured" finding. */
function isPartiallyObscured(check: CheckResult): boolean {
  const data: unknown = check.data;
  return typeof data === 'object' && data !== null && 'messageKey' in data && data.messageKey === 'partiallyObscured';
}

/** The plain selectors of the controls that partly cover the target (axe lists them on the check). */
function coveringSelectors(check: CheckResult): string[] {
  return (check.relatedNodes ?? []).flatMap((related) => {
    const selector = plainSelector(related.target);
    return selector === null ? [] : [selector];
  });
}

/** One page script: does any of these elements sit in, or inside, an element with position fixed or sticky? */
function inFixedOrStickyBar(selectors: readonly string[]): string {
  return `(() => {
    for (const selector of ${JSON.stringify(selectors)}) {
      let element = null;
      try { element = document.querySelector(selector); } catch { element = null; }
      for (let node = element; node !== null; node = node.parentElement) {
        const position = getComputedStyle(node).position;
        if (position === 'fixed' || position === 'sticky') { return true; }
      }
    }
    return false;
  })()`;
}

/** Scrolls the target to the middle of the padded scrollport and waits for the scroll to stop; returns the old offsets. */
function scrollToMiddle(selector: string): string {
  return `(async () => {
    const element = document.querySelector(${JSON.stringify(selector)});
    if (element === null) { return null; }
    const ancestors = [];
    let depth = 0;
    for (let node = element.parentElement; node !== null; node = node.parentElement) {
      ancestors.push([depth, node.scrollTop, node.scrollLeft]);
      depth += 1;
    }
    const saved = { x: window.scrollX, y: window.scrollY, ancestors };
    element.scrollIntoView({ block: 'center', inline: 'nearest', behavior: 'instant' });
    let steady = 0;
    let last = Number.NaN;
    for (let frame = 0; frame < 120 && steady < 5; frame += 1) {
      await new Promise((resolve) => requestAnimationFrame(resolve));
      steady = window.scrollY === last ? steady + 1 : 0;
      last = window.scrollY;
    }
    return saved;
  })()`;
}

/** Puts every recorded scroll offset back. */
function restoreScroll(selector: string, saved: ScrollState): string {
  return `(() => {
    const saved = ${JSON.stringify(saved)};
    const element = document.querySelector(${JSON.stringify(selector)});
    if (element !== null) {
      let node = element.parentElement;
      for (let depth = 0; node !== null; depth += 1, node = node.parentElement) {
        const offsets = saved.ancestors.find((entry) => entry[0] === depth);
        if (offsets !== undefined) { node.scrollTop = offsets[1]; node.scrollLeft = offsets[2]; }
      }
    }
    window.scrollTo({ left: saved.x, top: saved.y, behavior: 'instant' });
    return true;
  })()`;
}

/**
 * D-71: whether a target-size finding is cleared by scrolling the target clear of a bar. Only a "partially obscured"
 * finding with at least one covering control in a fixed or sticky bar is re-checked: the target is scrolled to the middle
 * of the padded window, target-size runs on it alone, and every scroll offset is put back. It is cleared only when
 * target-size passes for it; a finding that is still covered, or not evaluated, stays.
 */
async function clearedByScrolling(page: Page, node: NodeResult): Promise<boolean> {
  const check = node.any.find((candidate) => candidate.id === 'target-size');
  const selector = plainSelector(node.target);
  if (check === undefined || selector === null || !isPartiallyObscured(check)) {
    return false;
  }
  const covering = coveringSelectors(check);
  if (covering.length === 0 || !(await page.evaluate<boolean>(inFixedOrStickyBar(covering)))) {
    return false;
  }
  const saved = await page.evaluate<ScrollState | null>(scrollToMiddle(selector));
  if (saved === null) {
    return false;
  }
  try {
    // options() replaces every option set before it, so it goes before withRules; passes are needed to tell "passed"
    // from "not evaluated".
    const rerun = await pageAxe(page)
      .options({ resultTypes: ['violations', 'passes'] })
      .withRules(['target-size'])
      .include(selector)
      .analyze();
    const here = (result: Result): boolean =>
      result.id === 'target-size' && result.nodes.some((candidate) => plainSelector(candidate.target) === selector);
    return rerun.passes.some(here) && !rerun.violations.some(here);
  } finally {
    await page.evaluate<boolean>(restoreScroll(selector, saved));
  }
}

/** The violations without the target-size nodes that scrolling clears (D-71); every other finding is kept as it is. */
async function withoutBarCoveredNodes(page: Page, violations: Result[]): Promise<Result[]> {
  const kept: Result[] = [];
  for (const violation of violations) {
    if (violation.id !== 'target-size') {
      kept.push(violation);
      continue;
    }
    const nodes: NodeResult[] = [];
    for (const node of violation.nodes) {
      if (!(await clearedByScrolling(page, node))) {
        nodes.push(node);
      }
    }
    if (nodes.length > 0) {
      kept.push({ ...violation, nodes });
    }
  }
  return kept;
}

/**
 * Runs axe over the whole page with pageAxe. The contrast rule stays on here, unlike in jsdom. Rejects with one
 * `<rule id>: <targets>` line per violation, sorted.
 *
 * D-71: a target-size finding that is only "partially obscured", where at least one covering control sits in a fixed or
 * sticky bar (the admin top bar, the phone tab bar, the public header), is scrolled to the middle of the window inside the
 * page's scroll padding, checked again for target-size alone, and the scroll is put back. It fails only if it is still
 * covered. Every other finding, and the message format, are unchanged.
 */
export async function expectNoAxeViolations(page: Page): Promise<void> {
  // Axe reads colors as painted, so a toast or dialog still fading in fails contrast. Finite animations finish first.
  await page.evaluate<boolean>(`(async () => {
    const running = document.getAnimations().filter((animation) => animation.effect?.getComputedTiming().iterations !== Infinity);
    await Promise.allSettled(running.map((animation) => animation.finished));
    return true;
  })()`);
  const results = await pageAxe(page).analyze();
  const lines = (await withoutBarCoveredNodes(page, results.violations))
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

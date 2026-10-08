// Shared E2E fixture (QUAL-04, A11Y-01, research Pattern 11). Import `test` and `expect` from here, never from
// @playwright/test, so every E2E test fails on:
//   - any console message of type error or warning,
//   - any uncaught page error,
//   - any Content-Security-Policy violation (reported through a Playwright binding, so it survives navigation, L-23),
//   - any same-origin response with status 400 or higher that the test did not declare with guard.expectStatus.
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
   * Declares that a same-origin response whose URL contains `urlPart` may answer `status` (400 or higher) in this test.
   * Every other failed response is a finding.
   */
  expectStatus(urlPart: string, status: number): void;
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
      const origin = new URL(baseURL ?? 'https://localhost:5199').origin;
      const expected: { urlPart: string; status: number }[] = [];
      let consoleMessages: string[] = [];
      let pageErrors: string[] = [];
      let cspViolations: CspViolation[] = [];
      let failedResponses: string[] = [];

      page.on('console', (message) => {
        const type = message.type();
        if (type === 'error' || type === 'warning') {
          const { url, lineNumber } = message.location();
          consoleMessages.push(`console.${type}: ${message.text()}${url ? ` (${url}:${String(lineNumber)})` : ''}`);
        }
      });
      page.on('pageerror', (error) => {
        pageErrors.push(error.message);
      });
      page.on('response', (response) => {
        const status = response.status();
        const url = response.url();
        if (status < 400 || new URL(url).origin !== origin) {
          return;
        }
        if (expected.some((entry) => entry.status === status && url.includes(entry.urlPart))) {
          return;
        }
        failedResponses.push(`${String(status)} ${response.request().method()} ${url}`);
      });
      await page.exposeBinding(CSP_BINDING, (_source, violation: unknown) => {
        cspViolations.push(
          isCspViolation(violation) ? violation : { directive: 'unknown', blockedURI: JSON.stringify(violation) },
        );
      });
      await page.addInitScript({ content: cspListener });

      // A round trip to the page delivers any binding call the page made before it, so a violation raised during the
      // last load is recorded before the guard reads it. A closed page has nothing left to deliver.
      const settle = async (): Promise<void> => {
        if (!page.isClosed()) {
          await page.evaluate('0').catch(() => undefined);
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

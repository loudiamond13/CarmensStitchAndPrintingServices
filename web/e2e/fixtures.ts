// Shared E2E fixture (QUAL-04, A11Y-01, research Pattern 11). Import `test` and `expect` from here, never from
// @playwright/test, so every E2E test fails on:
//   - any console message of type error or warning,
//   - any uncaught page error,
//   - any Content-Security-Policy violation,
//   - any same-origin response with status 400 or higher.
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
  /** Returns and clears the record. Only the fixture self-tests need it: they provoke a finding on purpose. */
  take(): Promise<GuardRecord>;
}

const CSP_BINDING = '__cspsE2eCspViolation';

// Runs before any page script in every document (assumption A1: init scripts run under the strict CSP). The listener
// reports through a Playwright binding, so a violation is kept even when the page navigates away afterwards.
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

function listFindings(record: GuardRecord): string[] {
  return [
    ...record.console,
    ...record.pageErrors.map((message) => `pageerror: ${message}`),
    ...record.cspViolations.map((violation) => `csp: ${violation.directive} blocked ${violation.blockedURI}`),
    ...record.failedResponses.map((response) => `response: ${response}`),
  ];
}

export const test = base.extend<{ guard: Guard }>({
  guard: [
    async ({ page, baseURL }, provide) => {
      const origin = new URL(baseURL ?? 'https://localhost:5199').origin;
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
        if (response.status() >= 400 && new URL(response.url()).origin === origin) {
          failedResponses.push(`${String(response.status())} ${response.request().method()} ${response.url()}`);
        }
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

      const take = async (): Promise<GuardRecord> => {
        await settle();
        const record: GuardRecord = {
          console: consoleMessages,
          pageErrors,
          cspViolations,
          failedResponses,
        };
        consoleMessages = [];
        pageErrors = [];
        cspViolations = [];
        failedResponses = [];
        return record;
      };

      await provide({ take });

      const findings = listFindings(await take());
      if (findings.length > 0) {
        throw new Error(`The page reported ${String(findings.length)} problem(s):\n${findings.join('\n')}`);
      }
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

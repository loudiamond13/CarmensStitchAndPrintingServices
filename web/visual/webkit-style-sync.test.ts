// @vitest-environment node
// Pins the narrow WebKit screenshot allowance (plan 02-14): exactly one blocked inline stylesheet and one matching
// console line per screenshot the suite took are discounted; every other finding stays a finding.
import { describe, expect, it } from 'vitest';
import type { VisualRecord } from './guard.ts';
import { STYLE_SYNC_CONSOLE, withoutScreenshotStyleSync } from './webkit-style-sync.ts';

const styleSync = { directive: 'style-src-elem', blockedURI: 'inline' };
const consoleLine = `${STYLE_SYNC_CONSOLE} (https://app.parity.test/parity.html?case=button-primary-md:0)`;

function record(overrides: Partial<VisualRecord> = {}): VisualRecord {
  return { console: [], pageErrors: [], cspViolations: [], failedRequests: [], ...overrides };
}

describe('withoutScreenshotStyleSync', () => {
  it('discounts one blocked inline stylesheet and its console line per screenshot', () => {
    const seen = record({ console: [consoleLine, consoleLine], cspViolations: [styleSync, styleSync] });

    expect(withoutScreenshotStyleSync(seen, 2)).toEqual(record());
  });

  it('keeps every finding beyond the number of screenshots, so a page that injects its own inline style still fails', () => {
    const seen = record({ console: [consoleLine, consoleLine], cspViolations: [styleSync, styleSync] });

    expect(withoutScreenshotStyleSync(seen, 1)).toEqual(record({ console: [consoleLine], cspViolations: [styleSync] }));
  });

  it('never discounts other violations, other console lines, page errors or failed requests', () => {
    const seen = record({
      console: ['console.error: Refused to execute inline script', 'console.warning: something'],
      cspViolations: [
        { directive: 'style-src-attr', blockedURI: 'inline' },
        { directive: 'style-src-elem', blockedURI: 'https://evil.example/x.css' },
        { directive: 'script-src-elem', blockedURI: 'inline' },
      ],
      pageErrors: ['boom'],
      failedRequests: ['404 GET https://app.parity.test/missing.js'],
    });

    expect(withoutScreenshotStyleSync(seen, 5)).toEqual(seen);
  });

  it('changes nothing when the suite took no screenshot (or the engine is not WebKit)', () => {
    const seen = record({ console: [consoleLine], cspViolations: [styleSync] });

    expect(withoutScreenshotStyleSync(seen, 0)).toBe(seen);
  });
});

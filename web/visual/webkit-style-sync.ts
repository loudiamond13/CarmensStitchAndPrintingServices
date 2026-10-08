// A recorded, narrow allowance for one Playwright artifact (WEB-02, D-33; plan 02-14). Before every screenshot in
// WebKit, Playwright's screenshotter appends `<style>body {}</style>` to the page for a moment to make WebKit sync its
// animations (playwright-core `inPagePrepareForScreenshots`, `shouldToggleStyleSheetToSyncAnimations`). The page's
// strict CSP blocks that element, as it must, and WebKit reports it: one `style-src-elem` violation for an inline style
// and one console error. Chromium and Firefox run the same helper in an isolated world that the page CSP does not
// cover, so they report nothing.
//
// Nothing here weakens the CSP: the style is still blocked. The guard only discounts exactly one such violation and
// one such console line per screenshot the suite itself took, in WebKit only. A page that injects an inline style on
// its own still fails: its findings are on top of the counted ones, or arrive in Chromium and Firefox too.
import type { CspViolation, VisualRecord } from './guard.ts';

/** The console line WebKit writes for a blocked inline stylesheet. */
export const STYLE_SYNC_CONSOLE =
  "console.error: Refused to apply a stylesheet because its hash, its nonce, or 'unsafe-inline' does not appear in the style-src directive of the Content Security Policy.";

function isStyleSyncViolation(violation: CspViolation): boolean {
  return violation.directive === 'style-src-elem' && violation.blockedURI === 'inline';
}

function isStyleSyncConsole(line: string): boolean {
  return line === STYLE_SYNC_CONSOLE || line.startsWith(`${STYLE_SYNC_CONSOLE} (`);
}

/** Removes the first `count` items that match, keeping the order of the rest. */
function discount<T>(items: readonly T[], count: number, matches: (item: T) => boolean): T[] {
  let left = count;
  return items.filter((item) => {
    if (left > 0 && matches(item)) {
      left -= 1;
      return false;
    }
    return true;
  });
}

/**
 * The record without the findings of `screenshots` WebKit screenshot preparations: at most one blocked inline
 * stylesheet and one matching console error per screenshot. Every other finding is kept.
 */
export function withoutScreenshotStyleSync(record: VisualRecord, screenshots: number): VisualRecord {
  if (screenshots <= 0) {
    return record;
  }
  return {
    ...record,
    console: discount(record.console, screenshots, isStyleSyncConsole),
    cspViolations: discount(record.cspViolations, screenshots, isStyleSyncViolation),
  };
}

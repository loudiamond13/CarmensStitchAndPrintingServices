// @vitest-environment node
// Pins the shared checks the browser sweeps run in the page (wave 11 IN-04, IN-05): the sideways-scroll test measures against the page
// width without a classic scrollbar, and the helper checks of the money sweep can fail.
import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';
import { describe, expect, it } from 'vitest';
import { NO_SIDEWAYS_SCROLL } from '../e2e/helpers.ts';

/** Runs the page script with a made-up page of the given sizes. */
function noSidewaysScroll(page: { innerWidth: number; scrollWidth: number; clientWidth: number }): unknown {
  return runInNewContext(NO_SIDEWAYS_SCROLL, {
    window: { innerWidth: page.innerWidth },
    document: { documentElement: { scrollWidth: page.scrollWidth, clientWidth: page.clientWidth } },
  });
}

describe('NO_SIDEWAYS_SCROLL', () => {
  it('passes a page that fits', () => {
    expect(noSidewaysScroll({ innerWidth: 320, scrollWidth: 320, clientWidth: 320 })).toBe(true);
  });

  it('fails a page that is wider than the window', () => {
    expect(noSidewaysScroll({ innerWidth: 320, scrollWidth: 347, clientWidth: 320 })).toBe(false);
  });

  it('fails an overflow narrower than a classic scrollbar (innerWidth 320 includes the 15 px bar, clientWidth 305 does not)', () => {
    expect(noSidewaysScroll({ innerWidth: 320, scrollWidth: 312, clientWidth: 305 })).toBe(false);
  });
});

describe('one copy of the sideways-scroll check', () => {
  it.each(['showcase.spec.ts', 'long-text.spec.ts'])(
    '%s imports it from helpers.ts and does not define its own',
    (file) => {
      const source = readFileSync(new URL(`../e2e/${file}`, import.meta.url), 'utf8');
      expect(source).not.toMatch(/const NO_SIDEWAYS_SCROLL\s*=/);
      expect(source).toMatch(/import \{[^}]*NO_SIDEWAYS_SCROLL[^}]*\} from '\.\/helpers\.ts'/);
    },
  );
});

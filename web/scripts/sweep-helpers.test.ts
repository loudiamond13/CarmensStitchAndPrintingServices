// @vitest-environment node
// Pins the shared checks the browser sweeps run in the page (wave 11 IN-04, IN-05): the sideways-scroll test measures against the page
// width without a classic scrollbar, and the helper checks of the money sweep can fail.
import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';
import { describe, expect, it } from 'vitest';
import { holdsItsContent, NO_SIDEWAYS_SCROLL, reachableWithoutScrolling, selectedTabInView } from '../e2e/helpers.ts';

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

/** A made-up element box. */
const box = (left: number, top: number, right: number, bottom: number) => ({ left, top, right, bottom });

/** A made-up button in a made-up dialog panel in a 320 x 568 window. */
function buttonIn(panel: ReturnType<typeof box> | null, button: ReturnType<typeof box>) {
  return {
    getBoundingClientRect: () => button,
    closest: () => (panel === null ? null : { getBoundingClientRect: () => panel }),
    ownerDocument: { documentElement: { clientWidth: 320, clientHeight: 568 } },
  };
}

describe('holdsItsContent', () => {
  it('passes an element whose content fits and fails one that scrolls sideways', () => {
    expect(holdsItsContent({ scrollWidth: 300, clientWidth: 300 })).toBe(true);
    expect(holdsItsContent({ scrollWidth: 301, clientWidth: 300 })).toBe(false);
  });
});

describe('reachableWithoutScrolling', () => {
  const panel = box(10, 40, 310, 540);

  it('passes a button inside the panel and the window', () => {
    expect(reachableWithoutScrolling(buttonIn(panel, box(20, 480, 150, 524)))).toBe(true);
  });

  it('fails a button below the window, even when the panel box reaches it', () => {
    expect(reachableWithoutScrolling(buttonIn(box(10, 40, 310, 700), box(20, 600, 150, 644)))).toBe(false);
  });

  it('fails a button outside the panel box', () => {
    expect(reachableWithoutScrolling(buttonIn(panel, box(20, 545, 150, 565)))).toBe(false);
  });

  it('passes a button cut off at the edge of the window while 44 px or more of it is left to press', () => {
    expect(reachableWithoutScrolling(buttonIn(panel, box(250, 480, 370, 524)))).toBe(true);
    expect(reachableWithoutScrolling(buttonIn(panel, box(-30, 480, 62, 524)))).toBe(true);
  });

  it('fails a button cut down to a sliver at the edge of the window', () => {
    expect(reachableWithoutScrolling(buttonIn(panel, box(300, 480, 440, 524)))).toBe(false);
    expect(reachableWithoutScrolling(buttonIn(panel, box(-120, 480, 20, 524)))).toBe(false);
  });

  it('fails a button with no dialog around it', () => {
    expect(reachableWithoutScrolling(buttonIn(null, box(20, 480, 150, 524)))).toBe(false);
  });
});

describe('selectedTabInView', () => {
  const strip = (tab: ReturnType<typeof box> | null) => ({
    getBoundingClientRect: () => box(0, 0, 320, 44),
    querySelector: () => (tab === null ? null : { getBoundingClientRect: () => tab }),
  });

  it('passes when the selected tab is inside the strip, though the strip may scroll', () => {
    expect(selectedTabInView(strip(box(100, 0, 230, 44)))).toBe(true);
  });

  it('fails when the selected tab is scrolled out of sight', () => {
    expect(selectedTabInView(strip(box(300, 0, 430, 44)))).toBe(false);
  });

  it('fails a strip with no selected tab', () => {
    expect(selectedTabInView(strip(null))).toBe(false);
  });
});

describe('the money sweep uses those checks', () => {
  const source = readFileSync(new URL('../e2e/money-sweep.spec.ts', import.meta.url), 'utf8');

  it('measures the opened dialog itself, not the first dialog of the page', () => {
    expect(source).toContain('dialog.evaluate(holdsItsContent)');
    expect(source).not.toContain('PANEL_FITS');
  });

  it('checks the selected tab, not that the strip is free of scrolling', () => {
    expect(source).toContain('evaluate(selectedTabInView)');
    expect(source).not.toContain('TAB_STRIPS_FIT');
  });

  it('checks the footer buttons without scrolling them into view first', () => {
    expect(source).toContain('evaluate(reachableWithoutScrolling)');
    expect(source).not.toContain('scrollIntoViewIfNeeded');
  });
});

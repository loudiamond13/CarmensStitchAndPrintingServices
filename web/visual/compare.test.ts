// @vitest-environment node
// Pins the comparator (WEB-02, D-33, threat T-02-39): the allowed normalizations, each in isolation, and nothing more.
// Everything that is not on the UI-SPEC list ("Look-Equality Proof" → the only normalizations allowed) must still be
// reported. The registry of intentional differences is checked here too: every entry carries an owner decision.
import { describe, expect, it } from 'vitest';
import { BOX_TOLERANCE, diffCases, normalizeRecord, splitList, VISUAL_PROPERTIES } from './compare.ts';
import type { CaseRecord, Difference, ElementRecord } from './compare.ts';
import {
  assertRegistry,
  elementExceptionsFor,
  maskedIconViewBox,
  maxDiffPixelsFor,
  STRUCTURAL_EXCEPTIONS,
  TOLERANCE_OVERRIDES,
  type ElementException,
  type StructuralException,
  type ToleranceOverride,
} from './intentional-differences.ts';

const BOX = { x: 0, y: 0, width: 100, height: 44 };

function element(overrides: Partial<ElementRecord> & Pick<ElementRecord, 'path'>): ElementRecord {
  return {
    tags: 'div',
    tag: 'div',
    pseudo: '',
    box: BOX,
    styles: {},
    icon: false,
    attributes: {},
    ...overrides,
  };
}

function record(...elements: ElementRecord[]): CaseRecord {
  return { elements };
}

/** Normalizes both sides, then diffs them, as the parity suite does. */
function compare(reference: CaseRecord, impl: CaseRecord, exceptions: readonly ElementException[] = []): Difference[] {
  return diffCases(normalizeRecord(reference), normalizeRecord(impl), exceptions);
}

function oneElement(styles: Record<string, string>, box = BOX): CaseRecord {
  return record(element({ path: '0', styles, box }));
}

describe('VISUAL_PROPERTIES', () => {
  it('reads about 80 visual properties, with no duplicates', () => {
    expect(VISUAL_PROPERTIES.length).toBeGreaterThanOrEqual(80);
    expect(new Set(VISUAL_PROPERTIES).size).toBe(VISUAL_PROPERTIES.length);
  });

  it('covers the box model, typography, colours, borders, radii, shadows, outline, motion, cursor and content', () => {
    for (const property of [
      'padding-top',
      'margin-left',
      'font-size',
      'font-weight',
      'line-height',
      'letter-spacing',
      'color',
      'background-color',
      'border-top-width',
      'border-top-left-radius',
      'box-shadow',
      'outline-width',
      'opacity',
      'cursor',
      'transition-duration',
      'animation-name',
      'content',
    ]) {
      expect(VISUAL_PROPERTIES).toContain(property);
    }
  });
});

describe('normalization: repeated transition-list entries collapse to one', () => {
  it('treats the spec shorthand list and the single utility value as equal', () => {
    const spec = {
      'transition-duration': '0.15s, 0.15s, 0.15s, 0.15s, 0.15s',
      'transition-timing-function': 'ease, ease, ease, ease, ease',
      'transition-delay': '0s, 0s, 0s, 0s, 0s',
    };
    const utility = { 'transition-duration': '0.15s', 'transition-timing-function': 'ease', 'transition-delay': '0s' };

    expect(compare(oneElement(spec), oneElement(utility))).toEqual([]);
  });

  it('keeps a list whose entries differ, and reports it', () => {
    expect(
      compare(oneElement({ 'transition-duration': '0.15s, 0.2s' }), oneElement({ 'transition-duration': '0.15s' })),
    ).toEqual([expect.objectContaining({ kind: 'style', property: 'transition-duration', reference: '0.15s, 0.2s' })]);
  });

  it('splits at top-level commas only, so a cubic-bezier keeps its own', () => {
    expect(splitList('cubic-bezier(0.4, 0, 0.2, 1), cubic-bezier(0.4, 0, 0.2, 1)')).toEqual([
      'cubic-bezier(0.4, 0, 0.2, 1)',
      'cubic-bezier(0.4, 0, 0.2, 1)',
    ]);
    expect(
      compare(
        oneElement({ 'transition-timing-function': 'cubic-bezier(0.4, 0, 0.2, 1), cubic-bezier(0.4, 0, 0.2, 1)' }),
        oneElement({ 'transition-timing-function': 'cubic-bezier(0.4, 0, 0.2, 1)' }),
      ),
    ).toEqual([]);
  });

  it('collapses nothing outside the transition lists', () => {
    expect(
      compare(oneElement({ 'animation-duration': '0.2s, 0.2s' }), oneElement({ 'animation-duration': '0.2s' })),
    ).toHaveLength(1);
  });
});

describe('normalization: border style and colour are ignored on 0-width sides only', () => {
  it('ignores style and colour of a 0px side', () => {
    const reference = { 'border-top-width': '0px', 'border-top-style': 'none', 'border-top-color': 'rgb(0, 0, 0)' };
    const impl = { 'border-top-width': '0px', 'border-top-style': 'solid', 'border-top-color': 'rgb(87, 46, 43)' };

    expect(compare(oneElement(reference), oneElement(impl))).toEqual([]);
  });

  it('reports style and colour of a 1px side', () => {
    const reference = { 'border-left-width': '1px', 'border-left-style': 'none', 'border-left-color': 'rgb(0, 0, 0)' };
    const impl = { 'border-left-width': '1px', 'border-left-style': 'solid', 'border-left-color': 'rgb(87, 46, 43)' };

    expect(compare(oneElement(reference), oneElement(impl)).map((difference) => difference.property)).toEqual([
      'border-left-style',
      'border-left-color',
    ]);
  });

  it('still reports a width difference when only one side is 0px wide', () => {
    const reference = { 'border-bottom-width': '0px', 'border-bottom-style': 'solid', 'border-bottom-color': 'red' };
    const impl = { 'border-bottom-width': '1px', 'border-bottom-style': 'solid', 'border-bottom-color': 'blue' };

    expect(compare(oneElement(reference), oneElement(impl)).map((difference) => difference.property)).toEqual([
      'border-bottom-width',
    ]);
  });
});

describe('normalization: outline style and colour are ignored at 0 width only', () => {
  it('ignores them when the outline width is 0px on both sides', () => {
    const reference = { 'outline-width': '0px', 'outline-style': 'none', 'outline-color': 'rgb(0, 0, 0)' };
    const impl = { 'outline-width': '0px', 'outline-style': 'solid', 'outline-color': 'rgb(255, 106, 26)' };

    expect(compare(oneElement(reference), oneElement(impl))).toEqual([]);
  });

  it('reports them when the outline is 2px wide (a focus ring)', () => {
    const reference = { 'outline-width': '2px', 'outline-style': 'solid', 'outline-color': 'rgb(0, 0, 0)' };
    const impl = { 'outline-width': '2px', 'outline-style': 'dashed', 'outline-color': 'rgb(255, 106, 26)' };

    expect(compare(oneElement(reference), oneElement(impl)).map((difference) => difference.property)).toEqual([
      'outline-style',
      'outline-color',
    ]);
  });
});

describe('normalization: icon <svg> wrappers are compared, their drawings skipped (D-32)', () => {
  const wrapper = { width: '18px', height: '18px', stroke: 'rgb(246, 223, 209)', 'vertical-align': 'middle' };

  it('skips every element inside an icon wrapper, whatever its tag, count or style', () => {
    const reference = record(
      element({ path: '0' }),
      element({ path: '0/0', tag: 'svg', icon: true, styles: wrapper }),
      element({ path: '0/0/0', tag: 'path', styles: { fill: 'none' } }),
      element({ path: '0/0/1', tag: 'circle' }),
    );
    const impl = record(
      element({ path: '0' }),
      element({ path: '0/0', tag: 'svg', icon: true, styles: wrapper }),
      element({ path: '0/0/0', tag: 'path', styles: { fill: 'black' }, box: { ...BOX, width: 7 } }),
    );

    expect(compare(reference, impl)).toEqual([]);
  });

  it('keeps comparing the wrapper itself and everything after it', () => {
    const reference = record(
      element({ path: '0/0', tag: 'svg', icon: true, styles: wrapper }),
      element({ path: '0/0/0', tag: 'path' }),
      element({ path: '0/1', tag: 'span', styles: { color: 'red' } }),
    );
    const impl = record(
      element({ path: '0/0', tag: 'svg', icon: true, styles: { ...wrapper, width: '16px' } }),
      element({ path: '0/1', tag: 'span', styles: { color: 'blue' } }),
    );

    expect(compare(reference, impl).map((difference) => `${difference.path} ${difference.property}`)).toEqual([
      '0/0 (div) width',
      '0/1 (div) color',
    ]);
  });

  it('does not skip the children of an svg that is not an icon wrapper', () => {
    const reference = record(element({ path: '0/0', tag: 'svg' }), element({ path: '0/0/0', tag: 'path' }));
    const impl = record(element({ path: '0/0', tag: 'svg' }));

    expect(compare(reference, impl)).toEqual([expect.objectContaining({ kind: 'structure', property: 'element' })]);
  });
});

describe('normalization: transforms are compared by box and pixels, not by their text', () => {
  it('ignores transform, translate, rotate and scale strings', () => {
    const spec = { transform: 'matrix(1, 0, 0, 1, 0, 1)', translate: 'none', rotate: 'none', scale: 'none' };
    const utility = { transform: 'none', translate: '0px 1px', rotate: '0deg', scale: '1' };

    expect(compare(oneElement(spec), oneElement(utility))).toEqual([]);
  });

  it('still reports the box the transform moves', () => {
    expect(compare(oneElement({ transform: 'none' }), oneElement({ transform: 'none' }, { ...BOX, y: 1 }))).toEqual([
      { path: '0 (div)', kind: 'box', property: 'y', reference: '0.00', impl: '1.00' },
    ]);
  });
});

describe('normalization: display: none subtrees are skipped', () => {
  it('drops a hidden element and its descendants from either side', () => {
    const reference = record(
      element({ path: '0' }),
      element({ path: '0/0', styles: { display: 'none' } }),
      element({ path: '0/0/0', tag: 'span' }),
      element({ path: '0/1', tag: 'span' }),
    );
    const impl = record(element({ path: '0' }), element({ path: '0/1', tag: 'span' }));

    expect(compare(reference, impl)).toEqual([]);
  });

  it('drops a hidden pseudo-element on its own, and keeps its element', () => {
    const reference = record(
      element({ path: '0', styles: { color: 'red' } }),
      element({ path: '0', pseudo: '::after', box: null, styles: { display: 'none', content: '""' } }),
    );
    const impl = record(element({ path: '0', styles: { color: 'blue' } }));

    expect(compare(reference, impl)).toEqual([expect.objectContaining({ kind: 'style', property: 'color' })]);
  });
});

describe('what is never normalized', () => {
  it('never compares attributes (class names, ARIA, lucide classes, D-28)', () => {
    const reference = record(element({ path: '0', attributes: { class: 'csp-btn csp-btn-primary' } }));
    const impl = record(
      element({ path: '0', attributes: { class: 'inline-flex bg-primary', 'aria-busy': 'true', role: 'img' } }),
    );

    expect(compare(reference, impl)).toEqual([]);
  });

  it('reports a box edge more than BOX_TOLERANCE apart, and not one within it', () => {
    expect(compare(oneElement({}), oneElement({}, { ...BOX, width: BOX.width + BOX_TOLERANCE / 2 }))).toEqual([]);
    expect(compare(oneElement({}), oneElement({}, { ...BOX, width: BOX.width + 0.02 }))).toEqual([
      { path: '0 (div)', kind: 'box', property: 'width', reference: '100.00', impl: '100.02' },
    ]);
  });

  it('reports any other property difference exactly', () => {
    expect(compare(oneElement({ 'padding-top': '0px' }), oneElement({ 'padding-top': '1px' }))).toEqual([
      { path: '0 (div)', kind: 'style', property: 'padding-top', reference: '0px', impl: '1px' },
    ]);
  });

  it('reports a missing or extra element and stops pairing there', () => {
    const reference = record(element({ path: '0' }), element({ path: '0/0', tag: 'span' }));
    const impl = record(element({ path: '0' }));

    expect(compare(reference, impl)).toEqual([
      expect.objectContaining({ kind: 'structure', property: 'element', impl: '(none)' }),
    ]);
  });

  it('reports a reordered tree (a different path at the same position) and stops pairing there', () => {
    const reference = record(element({ path: '0/0', styles: { color: 'red' } }), element({ path: '0/1' }));
    const impl = record(element({ path: '0/1', styles: { color: 'blue' } }), element({ path: '0/0' }));

    expect(compare(reference, impl)).toEqual([expect.objectContaining({ kind: 'structure', property: 'order' })]);
  });

  it('reports a pseudo-element present on one side only', () => {
    const reference = record(element({ path: '0' }), element({ path: '0', pseudo: '::after', box: null }));
    const impl = record(element({ path: '0' }));

    expect(compare(reference, impl)).toEqual([expect.objectContaining({ kind: 'structure', property: 'element' })]);
  });
});

describe('structural exceptions: a tag mismatch is reported unless the registry lists it with a decision', () => {
  const logoutPath = '0/0/2/0';
  const reference = record(element({ path: logoutPath, tag: 'a', styles: { cursor: 'pointer' } }));
  const impl = record(element({ path: logoutPath, tag: 'button', styles: { cursor: 'pointer' } }));

  it('reports a tag mismatch with no exception', () => {
    expect(compare(reference, impl)).toEqual([
      expect.objectContaining({ kind: 'structure', property: 'tag', reference: 'a', impl: 'button' }),
    ]);
  });

  it('accepts the D-27 Logout a → button at its listed scenario and path, and still compares its styles', () => {
    const exceptions = elementExceptionsFor('sidebar-collapsed');
    expect(exceptions).toEqual([expect.objectContaining({ path: logoutPath, decision: 'D-27' })]);

    expect(compare(reference, impl, exceptions)).toEqual([]);
    const restyled = record(element({ path: logoutPath, tag: 'button', styles: { cursor: 'default' } }));
    expect(compare(reference, restyled, exceptions)).toEqual([
      expect.objectContaining({ kind: 'style', property: 'cursor' }),
    ]);
  });

  it('still reports the mismatch at another path, for another scenario, or for another tag pair', () => {
    const elsewhere = record(element({ path: '0/0/1/0', tag: 'a' }));
    const elsewhereImpl = record(element({ path: '0/0/1/0', tag: 'button' }));
    expect(compare(elsewhere, elsewhereImpl, elementExceptionsFor('sidebar-collapsed'))).toHaveLength(1);

    expect(compare(reference, impl, elementExceptionsFor('button-primary-md'))).toHaveLength(1);

    const div = record(element({ path: logoutPath, tag: 'div', styles: { cursor: 'pointer' } }));
    expect(compare(reference, div, elementExceptionsFor('sidebar-collapsed'))).toHaveLength(1);
  });
});

describe('the intentional-differences registry', () => {
  it('lists the D-27 Logout exception for the three sidebar scenarios and the D-32 icon-drawing mask', () => {
    expect(
      STRUCTURAL_EXCEPTIONS.map((entry) =>
        entry.kind === 'element' ? `${entry.scenario} ${entry.decision}` : entry.decision,
      ),
    ).toEqual(['sidebar-dashboard-current D-27', 'sidebar-users-current D-27', 'sidebar-collapsed D-27', 'D-32']);
    expect(maskedIconViewBox()).toBe('0 0 24 24');
  });

  it('has no tolerance override, so every case must be pixel-identical', () => {
    expect(TOLERANCE_OVERRIDES).toEqual([]);
    expect(maxDiffPixelsFor('button-primary-md')).toBe(0);
  });

  it('passes its own check', () => {
    expect(() => {
      assertRegistry();
    }).not.toThrow();
  });

  const logout: ElementException = {
    kind: 'element',
    scenario: 'sidebar-collapsed',
    path: '0/0/2/0',
    reference: 'a',
    impl: 'button',
    decision: 'D-27',
    reason: 'Logout is a button.',
  };
  const tolerance: ToleranceOverride = {
    scenario: 'chart',
    maxDiffPixels: 2,
    decision: 'D-99',
    reason: 'Owner accepted sub-pixel anti-aliasing.',
  };

  it.each<[string, readonly StructuralException[], readonly ToleranceOverride[], RegExp]>([
    ['no decision ID', [{ ...logout, decision: 'owner said so' }], [], /needs an owner decision ID/],
    ['an empty reason', [{ ...logout, reason: '  ' }], [], /needs a reason/],
    ['the same tag on both sides', [{ ...logout, impl: 'a' }], [], /same tag/],
    ['a duplicate entry', [logout, logout], [], /more than once/],
    ['a tolerance without a decision', [], [{ ...tolerance, decision: '' }], /needs an owner decision ID/],
    ['a fractional pixel tolerance', [], [{ ...tolerance, maxDiffPixels: 0.5 }], /whole, non-negative/],
    ['a negative pixel tolerance', [], [{ ...tolerance, maxDiffPixels: -1 }], /whole, non-negative/],
  ])('rejects %s', (_name, structural, tolerances, message) => {
    expect(() => {
      assertRegistry(structural, tolerances);
    }).toThrow(message);
  });

  it('accepts a tolerance override that carries a decision and a reason, and applies it to its scenario only', () => {
    expect(() => {
      assertRegistry([], [tolerance]);
    }).not.toThrow();
    expect(maxDiffPixelsFor('chart', [tolerance])).toBe(2);
    expect(maxDiffPixelsFor('button-primary-md', [tolerance])).toBe(0);
  });
});

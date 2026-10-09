// @vitest-environment node
// Pins the test-only owner-rulings layer of the parity reference (WEB-02, D-33, UI-SPEC "Intentional differences").
// The look-equality proof holds the Tailwind implementation to the verbatim spec CSS plus exactly this file, so:
//   - every owner look ruling has its own commented rule group, and the comment names the decision ID;
//   - D-38 has nothing here (the phone list-card separator stays exactly as the approved CSS renders it);
//   - every selector names a spec class (.csp-* or .s-*), except inside the O-6 reduced-motion block and the PERF-05
//     font faces and font-stack tokens, so the layer can only ever restyle the frozen reference;
//   - the PERF-05 faces and stacks are identical to the shipped web/src/styles/base.css;
//   - nothing in the app imports it.
import { readdirSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const here = path.dirname(fileURLToPath(import.meta.url));
const rulingsCss = readFileSync(path.join(here, 'rulings.css'), 'utf8');
const baseCss = readFileSync(path.resolve(here, '../../src/styles/base.css'), 'utf8');

/** The rulings the layer must carry, as the leading words of their group comments. */
const RULING_IDS = [
  'D-01',
  'D-02',
  'D-02 FYI-01',
  'D-03',
  'D-05',
  'D-27',
  'D-31 O-3',
  'O-6',
  'D-31 D-BL-02',
  'WEB-09',
  'PERF-05',
  'D-39',
] as const;

interface Group {
  /** The comment right before the group (trimmed), or null when the group has none of its own. */
  readonly comment: string | null;
  /** The selector list or the at-rule prelude. */
  readonly prelude: string;
  /** The text between the braces. */
  readonly body: string;
}

/** Splits CSS into its top-level groups, keeping the comment that directly precedes each one. */
function groupsOf(css: string): Group[] {
  const groups: Group[] = [];
  let comment: string | null = null;
  let i = 0;
  while (i < css.length) {
    if (css.startsWith('/*', i)) {
      const end = css.indexOf('*/', i + 2);
      comment = css.slice(i + 2, end).trim();
      i = end + 2;
      continue;
    }
    if (/\s/.test(css.charAt(i))) {
      i += 1;
      continue;
    }
    const open = css.indexOf('{', i);
    let depth = 0;
    let close = open;
    for (; close < css.length; close += 1) {
      const char = css.charAt(close);
      if (char === '{') {
        depth += 1;
      } else if (char === '}') {
        depth -= 1;
        if (depth === 0) {
          break;
        }
      }
    }
    groups.push({ comment, prelude: css.slice(i, open).trim(), body: css.slice(open + 1, close) });
    comment = null;
    i = close + 1;
  }
  return groups;
}

/** The most specific ruling ID a comment starts with, or null. */
function rulingOf(comment: string | null): string | null {
  if (comment === null) {
    return null;
  }
  const matches = RULING_IDS.filter((id) => comment === id || comment.startsWith(`${id} `));
  return matches.sort((a, b) => b.length - a.length)[0] ?? null;
}

const normalize = (text: string): string => text.replace(/\s+/g, ' ').trim();
const selectorsOf = (prelude: string): string[] => prelude.split(',').map((selector) => normalize(selector));
const SPEC_CLASS = /\.(?:csp|s)-[a-z]/;

const groups = groupsOf(rulingsCss);
const byRuling = (id: string): Group[] => groups.filter((group) => rulingOf(group.comment) === id);
const declarations = (id: string): string =>
  byRuling(id)
    .map((group) => normalize(group.body))
    .join(' | ');

describe('rulings.css: one commented rule group per owner ruling', () => {
  it.each(RULING_IDS)('has a rule group whose comment starts with %s', (id) => {
    expect(byRuling(id).length).toBeGreaterThan(0);
  });

  it('starts every rule group with a comment that names its decision ID', () => {
    const unnamed = groups.filter((group) => rulingOf(group.comment) === null).map((group) => group.prelude);

    expect(unnamed).toEqual([]);
  });

  it('has nothing for D-38: the phone list-card separator stays as the approved CSS renders it', () => {
    expect(rulingsCss).not.toContain('D-38');
  });

  it('has no rule group for D-40 (text only): the header says the WalkInOrderCard pair writes "Walk-in customer"', () => {
    const header = rulingsCss.slice(0, rulingsCss.indexOf('*/'));

    expect(groups.filter((group) => group.comment?.startsWith('D-40') === true)).toEqual([]);
    expect(normalize(header)).toContain('D-40');
    expect(normalize(header)).toContain('WalkInOrderCard');
    expect(normalize(header)).toContain('"Walk-in customer"');
  });
});

describe('rulings.css: the layer can only restyle the frozen reference', () => {
  it('names a spec class in every selector outside the O-6 block and the PERF-05 font rules', () => {
    const offenders: string[] = [];
    for (const group of groups) {
      const ruling = rulingOf(group.comment);
      if (group.prelude === '@font-face' || group.prelude === ':root') {
        if (ruling !== 'PERF-05') {
          offenders.push(`${group.prelude} outside PERF-05`);
        }
        continue;
      }
      if (group.prelude.startsWith('@media (prefers-reduced-motion')) {
        if (ruling !== 'O-6') {
          offenders.push(`${group.prelude} outside O-6`);
        }
        continue;
      }
      const rules = group.prelude.startsWith('@') ? groupsOf(group.body) : [group];
      for (const rule of rules) {
        offenders.push(...selectorsOf(rule.prelude).filter((selector) => !SPEC_CLASS.test(selector)));
      }
    }

    expect(offenders).toEqual([]);
  });

  it('sets only the two font-stack tokens on :root (PERF-05)', () => {
    const root = groups.filter((group) => group.prelude === ':root');
    const properties = root.flatMap((group) =>
      group.body
        .split(';')
        .map((declaration) => declaration.split(':')[0]?.trim() ?? '')
        .filter((property) => property !== ''),
    );

    expect(properties.sort()).toEqual(['--font-display', '--font-sans']);
  });

  it('is imported by the reference stylesheet only, never by the app', () => {
    // Shipped app sources only: test files may name the file in lint fixtures.
    const appFiles = readdirSync(path.resolve(here, '../../src'), { recursive: true, encoding: 'utf8' }).filter(
      (file) => /\.(?:css|tsx?)$/.test(file) && !/\.test\.tsx?$/.test(file),
    );
    const importers = appFiles.filter((file) =>
      /^\s*(?:@import|import)\b[^;\n]*rulings\.css/m.test(readFileSync(path.resolve(here, '../../src', file), 'utf8')),
    );

    expect(importers).toEqual([]);
    expect(readFileSync(path.join(here, 'reference.css'), 'utf8')).toContain('@import "./rulings.css";');
  });
});

describe('rulings.css: the PERF-05 faces and stacks are identical to web/src/styles/base.css', () => {
  const tokenOf = (css: string, name: string): string =>
    normalize(new RegExp(`${name}:\\s*([^;]+);`).exec(css)?.[1] ?? `missing ${name}`);
  const facesOf = (css: string): string[] =>
    groupsOf(css)
      .filter((group) => group.prelude === '@font-face')
      .map((group) => normalize(group.body));

  it('declares the same metric-matched fallback faces', () => {
    expect(facesOf(baseCss)).toHaveLength(2);
    expect(facesOf(rulingsCss)).toEqual(facesOf(baseCss));
  });

  it('declares the same font stacks', () => {
    expect(tokenOf(rulingsCss, '--font-display')).toBe(tokenOf(baseCss, '--font-display'));
    expect(tokenOf(rulingsCss, '--font-sans')).toBe(tokenOf(baseCss, '--font-sans'));
  });
});

describe('rulings.css: each ruling restyles what the owner ruled on', () => {
  it('D-01: phone text inputs in the search box, toolbar and item rows are 16px', () => {
    const phone = byRuling('D-01').filter((group) => group.prelude === '@container pg (max-width: 767px)');
    const rules = phone.flatMap((group) => groupsOf(group.body));

    expect(rules.flatMap((rule) => selectorsOf(rule.prelude)).sort()).toEqual(
      ['.csp-search input', '.s-item .csp-input', '.s-search-box input', '.s-toolbar .csp-input'].sort(),
    );
    expect(rules.map((rule) => normalize(rule.body))).toEqual(['font-size: 16px;']);
  });

  it('D-02: inactive rows sit on --surface-2 (cells, and the phone card) with no opacity', () => {
    const css = declarations('D-02');

    expect(byRuling('D-02').map((group) => group.prelude)).toEqual([
      '.s-rt tbody tr.is-inactive > td',
      '@container pg (max-width: 767px)',
    ]);
    expect(css).toContain('background: var(--surface-2);');
    expect(css).toContain('.s-rt tbody tr.is-inactive');
    expect(css).not.toContain('opacity');
  });

  it('D-02 FYI-01: the five faded spec texts render at full opacity', () => {
    const [group] = byRuling('D-02 FYI-01');

    expect(selectorsOf(group?.prelude ?? '').sort()).toEqual(
      ['.csp-input::placeholder', '.csp-nav-tag', '.s-bigbtn span', '.s-cut-accent .s-lead', '.s-pill-count'].sort(),
    );
    expect(normalize(group?.body ?? '')).toBe('opacity: 1;');
  });

  it('D-03: the current or selected tab, site link, sidebar item and tab-bar item are 700, and the checkbox has its cue', () => {
    const bold = byRuling('D-03').find((group) => normalize(group.body) === 'font-weight: 700;');
    const css = declarations('D-03');

    expect(selectorsOf(bold?.prelude ?? '').sort()).toEqual(
      ['.csp-nav.is-on', '.csp-site-link.is-on', '.csp-tab.is-on', '.s-tab-i.is-on'].sort(),
    );
    expect(css).toContain('border: 2px solid var(--ink);');
    expect(css).toContain('background: var(--accent);');
    expect(css).toContain('border-bottom: 2px solid var(--on-accent);');
    expect(css).toContain('outline: 2px solid var(--focus);');
  });

  it('D-05: the thumb grip and actions show on focus within the thumb and always on touch', () => {
    const preludes = byRuling('D-05').map((group) => group.prelude);

    expect(preludes).toContain('.csp-thumb:focus-within .csp-thumb-grip');
    expect(preludes).toContain('@media (hover: none)');
    expect(declarations('D-05')).toContain('opacity: 1;');
  });

  it('D-27: the Logout button.csp-nav drops the button look and keeps the link alignment and cursor', () => {
    const [group] = byRuling('D-27');

    expect(group?.prelude).toBe('button.csp-nav');
    expect(normalize(group?.body ?? '')).toBe('appearance: none; border-width: 0; text-align: start; cursor: pointer;');
  });

  it('D-31 O-3: the current public drawer link is italic', () => {
    const [group] = byRuling('D-31 O-3');

    expect(group?.prelude).toBe('.csp-site-dlink.is-on');
    expect(normalize(group?.body ?? '')).toBe('font-style: italic;');
  });

  it('O-6: reduced motion stops the skeleton shimmer and the modal and toast entry animations', () => {
    const [group] = byRuling('O-6');
    const rules = groupsOf(group?.body ?? '');

    expect(group?.prelude).toBe('@media (prefers-reduced-motion: reduce)');
    expect(rules.flatMap((rule) => selectorsOf(rule.prelude)).sort()).toEqual(
      ['.csp-modal', '.csp-overlay', '.csp-skel', '.csp-toast'].sort(),
    );
    expect(rules.map((rule) => normalize(rule.body))).toEqual(['animation: none;']);
  });

  it('D-31 D-BL-02: the Manager tag is hidden on the current sidebar row', () => {
    const [group] = byRuling('D-31 D-BL-02');

    expect(group?.prelude).toBe('.csp-nav.is-on .csp-nav-tag');
    expect(normalize(group?.body ?? '')).toBe('display: none;');
  });

  it('D-39: a zero KpiCard figure (marked data-zero by the DimmedZeroKpi pair) is --ink-subtle, colour only', () => {
    const groupsOfD39 = byRuling('D-39');

    expect(groupsOfD39.map((group) => group.prelude)).toEqual(['.csp-kpi-value[data-zero]']);
    expect(normalize(groupsOfD39[0]?.body ?? '')).toBe('color: var(--ink-subtle);');
  });

  it('WEB-09: an aria-disabled button looks like the disabled button and never nudges or hovers', () => {
    const preludes = byRuling('WEB-09').map((group) => group.prelude);

    expect(preludes).toContain('.csp-btn[aria-disabled="true"]');
    expect(preludes).toContain('.csp-btn[aria-disabled="true"]:active');
    expect(declarations('WEB-09')).toContain('opacity: 0.45; cursor: not-allowed;');
    for (const variant of ['primary', 'secondary', 'ghost', 'danger', 'ghost-danger']) {
      expect(preludes).toContain(`.csp-btn-${variant}[aria-disabled="true"]:hover`);
    }
  });
});

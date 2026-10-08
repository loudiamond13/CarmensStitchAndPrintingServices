// @vitest-environment node
// WEB-02, D-07: the five design stylesheets are the CSPS-UI-SPEC.md App. A, A.2, A.3, B and C code blocks,
// byte-for-byte after LF normalization (research Pitfall 5: the spec file mixes CRLF and LF). The files are never
// edited; every owner reconciliation lives in overrides.css. This test also pins the main.tsx stylesheet order,
// because the order is part of the visual contract (02-UI-SPEC "CSS file contract").
import { existsSync, readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const specUrl = new URL('../../../CSPS-UI-SPEC.md', import.meta.url);
const stylesUrl = new URL('./', import.meta.url);
const mainUrl = new URL('../main.tsx', import.meta.url);

const VERBATIM_FILES = ['tokens', 'globals', 'compat', 'components', 'screens'] as const;

function toLf(text: string): string {
  return text.replace(/\r\n?/g, '\n');
}

function trimOneTrailingNewline(text: string): string {
  return text.endsWith('\n') ? text.slice(0, -1) : text;
}

/** The first ```css block after the spec heading that names src/styles/<name>.css, LF-normalized. */
function specBlock(name: string): string | null {
  const lines = toLf(readFileSync(specUrl, 'utf8')).split('\n');
  const headingIndex = lines.findIndex((line) => /^#{1,6} /.test(line) && line.includes(`src/styles/${name}.css`));
  if (headingIndex < 0) {
    return null;
  }
  const openIndex = lines.findIndex((line, index) => index > headingIndex && line === '```css');
  if (openIndex < 0) {
    return null;
  }
  const closeIndex = lines.findIndex((line, index) => index > openIndex && line === '```');
  if (closeIndex < 0) {
    return null;
  }
  return lines.slice(openIndex + 1, closeIndex).join('\n');
}

function readIfPresent(url: URL): string | null {
  return existsSync(url) ? readFileSync(url, 'utf8') : null;
}

describe('verbatim design CSS (WEB-02, D-07)', () => {
  it.each(VERBATIM_FILES)('src/styles/%s.css equals its spec appendix block after LF normalization', (name) => {
    const expected = specBlock(name);
    expect(expected, `spec block for src/styles/${name}.css`).not.toBeNull();
    const actual = readIfPresent(new URL(`${name}.css`, stylesUrl));
    expect(actual === null ? null : trimOneTrailingNewline(toLf(actual))).toBe(
      expected === null ? null : trimOneTrailingNewline(expected),
    );
  });

  it('keeps the verbatim files in LF (no carriage returns in the working tree)', () => {
    for (const name of VERBATIM_FILES) {
      const actual = readIfPresent(new URL(`${name}.css`, stylesUrl));
      expect(actual, `src/styles/${name}.css`).not.toBeNull();
      expect(actual?.includes('\r') ?? true, `src/styles/${name}.css has CR`).toBe(false);
    }
  });
});

describe('main.tsx stylesheet load order (D-07, A11Y-04 ordering edge)', () => {
  const ORDER = [
    "'@fontsource/barlow-condensed/600.css'",
    "'@fontsource/barlow-condensed/700.css'",
    "'@fontsource/barlow-condensed/800.css'",
    "'@fontsource/barlow-condensed/800-italic.css'",
    "'@fontsource-variable/archivo'",
    "'./styles/globals.css'",
    "'./styles/spec-gaps.css'",
    "'./styles/overrides.css'",
  ];

  it('imports the five font files, then globals, then spec-gaps, then overrides', () => {
    const source = readFileSync(mainUrl, 'utf8');
    const positions = ORDER.map((specifier) => source.indexOf(`import ${specifier};`));
    expect(positions.every((position) => position >= 0)).toBe(true);
    expect([...positions].sort((a, b) => a - b)).toEqual(positions);
  });

  it('never imports the per-subset fontsource files, which have no unicode-range (research Pitfall 18)', () => {
    const source = readFileSync(mainUrl, 'utf8');
    expect(source).not.toMatch(/@fontsource[^'"]*\/(latin|latin-ext|vietnamese)-/);
  });

  it('marks the two extra imports as a SPEC-DEVIATION', () => {
    const source = readFileSync(mainUrl, 'utf8');
    const marked = source
      .split('\n')
      .filter((line) => line.includes("'./styles/spec-gaps.css'") || line.includes("'./styles/overrides.css'"))
      .filter((line) => line.includes('// SPEC-DEVIATION: D-07 overrides/spec-gaps load order'));
    expect(marked).toHaveLength(2);
  });
});

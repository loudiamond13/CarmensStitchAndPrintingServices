// @vitest-environment node
// WEB-02, D-07: src/ui/__reference__ holds CSPS-UI-SPEC.md App. D.3, D.4 and D.5 exactly as published. They are the
// frozen baseline the differential DOM test compares the reconciled design system against, so they must never drift
// from the spec text (Edge Coverage: a spec re-import needs the owner's approval).
import { existsSync, readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const specUrl = new URL('../../../CSPS-UI-SPEC.md', import.meta.url);
const referenceUrl = new URL('./__reference__/', import.meta.url);

const FILES = [
  { appendix: 'D.3', specPath: 'src/ui/index.tsx', file: 'index.tsx' },
  { appendix: 'D.4', specPath: 'src/ui/mark.ts', file: 'mark.ts' },
  { appendix: 'D.5', specPath: 'src/ui/icons.ts', file: 'icons.ts' },
] as const;

function toLf(text: string): string {
  return text.replace(/\r\n?/g, '\n');
}

function trimOneTrailingNewline(text: string): string {
  return text.endsWith('\n') ? text.slice(0, -1) : text;
}

/** The first fenced code block after the spec heading that names specPath, LF-normalized. */
function specBlock(specPath: string): string | null {
  const lines = toLf(readFileSync(specUrl, 'utf8')).split('\n');
  const headingIndex = lines.findIndex((line) => /^#{1,6} /.test(line) && line.includes(specPath));
  if (headingIndex < 0) {
    return null;
  }
  const openIndex = lines.findIndex((line, index) => index > headingIndex && /^```[a-z]+$/.test(line));
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

describe('frozen reference copies (WEB-02, D-07)', () => {
  it.each(FILES)('__reference__/$file equals App. $appendix ($specPath) after LF normalization', ({ specPath, file }) => {
    const expected = specBlock(specPath);
    expect(expected, `spec block for ${specPath}`).not.toBeNull();
    expect(expected?.length ?? 0, `spec block for ${specPath} is not empty`).toBeGreaterThan(100);
    const actual = readIfPresent(new URL(file, referenceUrl));
    expect(actual === null ? null : trimOneTrailingNewline(toLf(actual))).toBe(
      expected === null ? null : trimOneTrailingNewline(expected),
    );
  });

  it('keeps the reference copies in LF', () => {
    for (const { file } of FILES) {
      const actual = readIfPresent(new URL(file, referenceUrl));
      expect(actual, file).not.toBeNull();
      expect(actual?.includes('\r') ?? true, `${file} has CR`).toBe(false);
    }
  });

  it('documents the frozen copies in a README with timestamps', () => {
    const readme = readIfPresent(new URL('README.md', referenceUrl));
    expect(readme).not.toBeNull();
    expect(readme ?? '').toMatch(/\*Created: \d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}[+-]\d{2}:\d{2} · Updated: /);
    expect(readme ?? '').toMatch(/owner/i);
  });
});

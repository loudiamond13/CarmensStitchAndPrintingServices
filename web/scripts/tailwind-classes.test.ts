// @vitest-environment node
// Class gate (D-33, WEB-02, D-02, A11Y-04, T-02-15): every class token in src compiles to CSS against the real CSPS
// theme in src/styles/app.css, carries no colour literal, and uses opacity only from the D-02 allow-list. The cleared
// theme makes a default-palette class or a typo emit nothing, silently (research Pitfall 23); this gate makes it fail.
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { COLOUR_LITERAL, OPACITY_ALLOW } from './class-gate.config.mjs';
import { buildCss, checkClassTokens, collectClassTokens, listSourceFiles, runClassGate } from './class-gate.mjs';

const tokensOf = (file: string, source: string): string[] =>
  collectClassTokens(file, source).map((entry) => entry.token);

/** `[token, kind]` pairs for every finding in one in-memory source file. */
async function findingsOf(file: string, source: string): Promise<[string, string][]> {
  const findings = await checkClassTokens(collectClassTokens(file, source), { file });
  return findings.map((finding) => [finding.token, finding.kind]);
}

const jsx = (classes: string): string => `export const A = () => <div className="${classes}" />;\n`;

describe('collectClassTokens', () => {
  it('reads a className string literal, one token per class, with its line', () => {
    const source = 'export const A = () => (\n  <div className="bg-surface p-4" />\n);\n';
    expect(collectClassTokens('src/ui/A.tsx', source)).toEqual([
      { token: 'bg-surface', line: 2 },
      { token: 'p-4', line: 2 },
    ]);
  });

  it('reads both branches of a conditional className, never the condition', () => {
    const source = "export const A = (o: { on: boolean }) => <div className={o.on ? 'bg-ink' : 'bg-line'} />;";
    expect(tokensOf('src/ui/A.tsx', source)).toEqual(['bg-ink', 'bg-line']);
  });

  it('reads clsx and tw arguments: strings, arrays, object keys and conditionals', () => {
    const source = [
      "import clsx from 'clsx';",
      "import { tw } from '@/ui/tw';",
      'export const f = (on: boolean) =>',
      "  clsx('flex gap-2', ['p-4', on && 'bg-ink'], { hidden: on, 'text-ink-muted underline': !on }, on ? 'm-1' : 'm-2');",
      "export const g = tw('rounded-pill');",
    ].join('\n');
    expect(tokensOf('src/ui/f.ts', source)).toEqual([
      'flex',
      'gap-2',
      'p-4',
      'bg-ink',
      'hidden',
      'text-ink-muted',
      'underline',
      'm-1',
      'm-2',
      'rounded-pill',
    ]);
  });

  it('ignores strings outside class positions in ordinary files', () => {
    const source = [
      "import { useState } from 'react';",
      "const label = 'Save changes';",
      'export const A = () => <button aria-label="Close dialog" type="button">{label}</button>;',
      'void useState;',
    ].join('\n');
    expect(tokensOf('src/ui/A.tsx', source)).toEqual([]);
  });

  it('reads every string literal in a *.recipe.ts file except imports, exports, property names and types', () => {
    const source = [
      "import clsx from 'clsx';",
      "import { tw } from '@/ui/tw';",
      "export { other } from './other';",
      "export type Tone = 'primary' | 'ghost-danger';",
      "const base = 'inline-flex ' + 'gap-2';",
      'const tone = {',
      "  primary: tw('bg-primary'),",
      "  'ghost-danger': 'bg-transparent text-danger',",
      '} as const satisfies Record<Tone, string>;',
      'export const toneClasses = (t: Tone) => clsx(base, tone[t]);',
    ].join('\n');
    expect(collectClassTokens('src/ui/button.recipe.ts', source)).toEqual([
      { token: 'inline-flex', line: 5 },
      { token: 'gap-2', line: 5 },
      { token: 'bg-primary', line: 7 },
      { token: 'bg-transparent', line: 8 },
      { token: 'text-danger', line: 8 },
    ]);
  });

  it('gives each token of a multi-line string its own line', () => {
    const source = 'export const c = tw(`flex\n  gap-2\n  p-4`);';
    expect(collectClassTokens('src/ui/c.ts', source)).toEqual([
      { token: 'flex', line: 1 },
      { token: 'gap-2', line: 2 },
      { token: 'p-4', line: 3 },
    ]);
  });
});

describe('checkClassTokens', () => {
  it('passes CSPS utilities', async () => {
    expect(await findingsOf('src/ui/A.tsx', jsx('bg-surface p-4'))).toEqual([]);
  });

  it('passes the CSPS theme names that replace the defaults', async () => {
    expect(await findingsOf('src/ui/A.tsx', jsx('font-bold font-button rounded-pill bg-surface-2'))).toEqual([]);
  });

  it('reports a cleared-theme default as unknown', async () => {
    expect(await findingsOf('src/ui/A.tsx', jsx('bg-blue-500'))).toEqual([['bg-blue-500', 'unknown']]);
  });

  it('reports every cleared default and a typo as unknown', async () => {
    expect(await findingsOf('src/ui/A.tsx', jsx('rounded-xl shadow-lg text-gray-600 hover:bg-surfce csp-btn'))).toEqual(
      [
        ['rounded-xl', 'unknown'],
        ['shadow-lg', 'unknown'],
        ['text-gray-600', 'unknown'],
        ['hover:bg-surfce', 'unknown'],
        ['csp-btn', 'unknown'],
      ],
    );
  });

  it('reports a hex colour literal even though it compiles', async () => {
    expect(await findingsOf('src/ui/a.ts', "export const a = tw('bg-[#ff6600]');")).toEqual([
      ['bg-[#ff6600]', 'colour-literal'],
    ]);
  });

  it('reports rgb( and oklch( colour literals', async () => {
    expect(await findingsOf('src/ui/A.tsx', jsx('bg-[rgb(0,0,0)] text-[oklch(50%_0.1_10)]'))).toEqual([
      ['bg-[rgb(0,0,0)]', 'colour-literal'],
      ['text-[oklch(50%_0.1_10)]', 'colour-literal'],
    ]);
  });

  it('reports an opacity token that is not allow-listed', async () => {
    expect(await findingsOf('src/ui/A.tsx', jsx('opacity-60'))).toEqual([['opacity-60', 'opacity']]);
  });

  it('reports opacity under any variant, and the arbitrary opacity property', async () => {
    expect(await findingsOf('src/ui/A.tsx', jsx('hover:opacity-80 [opacity:.5]'))).toEqual([
      ['hover:opacity-80', 'opacity'],
      ['[opacity:.5]', 'opacity'],
    ]);
  });

  it('allows the disabled and pending opacity in any file (D-02)', async () => {
    expect(await findingsOf('src/ui/A.tsx', jsx('disabled:opacity-45 aria-disabled:opacity-45'))).toEqual([]);
  });

  it('allows the thumb reveal opacity only in the ImageUploader files (D-05)', async () => {
    const reveal =
      'group/thumb opacity-0 group-hover/thumb:opacity-100 group-focus-within/thumb:opacity-100 no-hover:opacity-100';
    expect(await findingsOf('src/ui/media/ImageUploader.tsx', jsx(reveal))).toEqual([]);
    expect(await findingsOf('src/ui/media/ImageUploader.recipe.ts', `export const r = '${reveal}';`)).toEqual([]);
    expect(await findingsOf('src/ui/Other.tsx', jsx(reveal))).toEqual([
      ['opacity-0', 'opacity'],
      ['group-hover/thumb:opacity-100', 'opacity'],
      ['group-focus-within/thumb:opacity-100', 'opacity'],
      ['no-hover:opacity-100', 'opacity'],
    ]);
  });

  it('names the file, line, token and reason in each finding', async () => {
    const file = 'src/ui/A.tsx';
    const findings = await checkClassTokens(collectClassTokens(file, jsx('p-4 bg-blue-500')), { file });
    expect(findings).toEqual([
      {
        file,
        line: 1,
        token: 'bg-blue-500',
        kind: 'unknown',
        message: expect.stringContaining('bg-blue-500') as unknown,
      },
    ]);
  });
});

describe('the custom variants emit the exact spec query text', () => {
  it('pg-phone, pg-tablet, pg-md-up, vp-lt-sm and no-hover', async () => {
    const css = await buildCss([
      'pg-phone:hidden',
      'pg-tablet:hidden',
      'pg-md-up:hidden',
      'vp-lt-sm:hidden',
      'no-hover:hidden',
    ]);
    expect(css).toContain('@container pg (max-width: 767px)');
    expect(css).toContain('@container pg (min-width: 768px) and (max-width: 1023px)');
    expect(css).toMatch(/@container pg \(min-width: 768px\) \{/);
    expect(css).toContain('@media (max-width: 639px)');
    expect(css).toContain('@media (hover: none)');
  });

  it('hover: is a plain :hover with no (hover: hover) media wrapper', async () => {
    const css = await buildCss(['hover:underline']);
    expect(css).toMatch(/\.hover\\:underline\s*\{\s*&:hover\s*\{|\.hover\\:underline:hover\s*\{/);
    expect(css).not.toContain('(hover: hover)');
  });
});

describe('class-gate.config.mjs', () => {
  it('every opacity allow-list entry names its decision', () => {
    expect(OPACITY_ALLOW.length).toBeGreaterThan(0);
    for (const entry of OPACITY_ALLOW) {
      expect(entry.decision).toMatch(/^D-\d+/);
    }
  });

  it('the colour-literal pattern catches hex, rgb(, rgba( and oklch(, and not token names', () => {
    for (const literal of ['bg-[#fff]', 'bg-[#ff660080]', 'bg-[rgb(0,0,0)]', 'bg-[rgba(0,0,0,.5)]', 'oklch(50%)']) {
      expect(COLOUR_LITERAL.test(literal)).toBe(true);
    }
    for (const token of ['bg-surface', 'text-ink-muted', 'bg-[color-mix(in_srgb,var(--bg)_82%,transparent)]']) {
      expect(COLOUR_LITERAL.test(token)).toBe(false);
    }
  });
});

describe('the real source', () => {
  it('lists src files without tests, src/test or declaration files', () => {
    const files = listSourceFiles();
    expect(files).toContain('src/main.tsx');
    expect(files).toContain('src/app/public/PublicPlaceholderPage.tsx');
    expect(files.filter((file) => /\.test\.tsx?$|^src\/test\/|\.d\.ts$/.test(file))).toEqual([]);
  });

  it('collects the real class tokens (so the sweep below is not vacuous)', () => {
    const tokens = listSourceFiles().flatMap((file) =>
      collectClassTokens(file, readFileSync(new URL(`../${file}`, import.meta.url), 'utf8')).map(
        (entry) => entry.token,
      ),
    );
    expect(tokens).toContain('@container/pg');
    expect(tokens).toContain('pg-phone:text-[52px]');
  });

  it('every class token in src compiles, with no colour literal and no stray opacity', async () => {
    expect(await runClassGate()).toEqual([]);
  });
});

// @vitest-environment node
// Class gate (D-33, WEB-02, D-02, A11Y-04, T-02-15): every class token in src compiles to CSS against the real CSPS
// theme in src/ui/app.css, carries no colour literal, and uses opacity only from the D-02 allow-list. The cleared
// theme makes a default-palette class or a typo emit nothing, silently (research Pitfall 23); this gate makes it fail.
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { COLOUR_LITERAL, COLOUR_LITERAL_SOURCE, OPACITY_ALLOW } from './class-gate.config.mjs';
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
    expect(collectClassTokens('src/components/A.tsx', source)).toEqual([
      { token: 'bg-surface', line: 2 },
      { token: 'p-4', line: 2 },
    ]);
  });

  it('reads both branches of a conditional className, never the condition', () => {
    const source = "export const A = (o: { on: boolean }) => <div className={o.on ? 'bg-ink' : 'bg-line'} />;";
    expect(tokensOf('src/components/A.tsx', source)).toEqual(['bg-ink', 'bg-line']);
  });

  it('reads clsx and tw arguments: strings, arrays, object keys and conditionals', () => {
    const source = [
      "import clsx from 'clsx';",
      "import { tw } from '@/ui/tw';",
      'export const f = (on: boolean) =>',
      "  clsx('flex gap-2', ['p-4', on && 'bg-ink'], { hidden: on, 'text-ink-muted underline': !on }, on ? 'm-1' : 'm-2');",
      "export const g = tw('rounded-pill');",
    ].join('\n');
    expect(tokensOf('src/components/f.ts', source)).toEqual([
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
    expect(tokensOf('src/components/A.tsx', source)).toEqual([]);
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
    expect(collectClassTokens('src/components/button.recipe.ts', source)).toEqual([
      { token: 'inline-flex', line: 5 },
      { token: 'gap-2', line: 5 },
      { token: 'bg-primary', line: 7 },
      { token: 'bg-transparent', line: 8 },
      { token: 'text-danger', line: 8 },
    ]);
  });

  it('gives each token of a multi-line string its own line', () => {
    const source = 'export const c = tw(`flex\n  gap-2\n  p-4`);';
    expect(collectClassTokens('src/components/c.ts', source)).toEqual([
      { token: 'flex', line: 1 },
      { token: 'gap-2', line: 2 },
      { token: 'p-4', line: 3 },
    ]);
  });
});

describe('checkClassTokens', () => {
  it('passes CSPS utilities', async () => {
    expect(await findingsOf('src/components/A.tsx', jsx('bg-surface p-4'))).toEqual([]);
  });

  it('passes the CSPS theme names that replace the defaults', async () => {
    expect(await findingsOf('src/components/A.tsx', jsx('font-bold font-button rounded-pill bg-surface-2'))).toEqual(
      [],
    );
  });

  it('reports a cleared-theme default as unknown', async () => {
    expect(await findingsOf('src/components/A.tsx', jsx('bg-blue-500'))).toEqual([['bg-blue-500', 'unknown']]);
  });

  it('reports every cleared default and a typo as unknown', async () => {
    expect(
      await findingsOf('src/components/A.tsx', jsx('rounded-xl shadow-lg text-gray-600 hover:bg-surfce csp-btn')),
    ).toEqual([
      ['rounded-xl', 'unknown'],
      ['shadow-lg', 'unknown'],
      ['text-gray-600', 'unknown'],
      ['hover:bg-surfce', 'unknown'],
      ['csp-btn', 'unknown'],
    ]);
  });

  it('passes the group and peer marker classes, which emit no CSS by design, and their variants', async () => {
    const markers = 'group group/nav peer peer/check group-aria-[current=page]/nav:hidden peer-checked:underline';
    expect(await findingsOf('src/components/A.tsx', jsx(markers))).toEqual([]);
    expect(await findingsOf('src/components/A.tsx', jsx('group/ peergroup'))).toEqual([
      ['group/', 'unknown'],
      ['peergroup', 'unknown'],
    ]);
  });

  it('reports a repeated unknown token every time, and a repeated known token never', async () => {
    expect(await findingsOf('src/components/A.tsx', jsx('p-4 bg-blue-500 p-4 bg-blue-500'))).toEqual([
      ['bg-blue-500', 'unknown'],
      ['bg-blue-500', 'unknown'],
    ]);
  });

  it('reports a hex colour literal even though it compiles', async () => {
    expect(await findingsOf('src/components/a.ts', "export const a = tw('bg-[#ff6600]');")).toEqual([
      ['bg-[#ff6600]', 'colour-literal'],
    ]);
  });

  it('reports rgb( and oklch( colour literals', async () => {
    expect(await findingsOf('src/components/A.tsx', jsx('bg-[rgb(0,0,0)] text-[oklch(50%_0.1_10)]'))).toEqual([
      ['bg-[rgb(0,0,0)]', 'colour-literal'],
      ['text-[oklch(50%_0.1_10)]', 'colour-literal'],
    ]);
  });

  // TOOL-WR-07: every CSS colour syntax, not only hex, rgb() and oklch().
  it('reports hsl(), the other colour functions and named colours as colour literals', async () => {
    expect(
      await findingsOf('src/components/A.tsx', jsx('bg-[hsl(0_0%_50%)] text-[color:tomato] border-[red]')),
    ).toEqual([
      ['bg-[hsl(0_0%_50%)]', 'colour-literal'],
      ['text-[color:tomato]', 'colour-literal'],
      ['border-[red]', 'colour-literal'],
    ]);
  });

  it('reports an opacity token that is not allow-listed', async () => {
    expect(await findingsOf('src/components/A.tsx', jsx('opacity-60'))).toEqual([['opacity-60', 'opacity']]);
  });

  it('reports opacity under any variant, and the arbitrary opacity property', async () => {
    expect(await findingsOf('src/components/A.tsx', jsx('hover:opacity-80 [opacity:.5]'))).toEqual([
      ['hover:opacity-80', 'opacity'],
      ['[opacity:.5]', 'opacity'],
    ]);
  });

  it('allows the disabled and pending opacity in any file (D-02)', async () => {
    expect(await findingsOf('src/components/A.tsx', jsx('disabled:opacity-45 aria-disabled:opacity-45'))).toEqual([]);
  });

  it('allows the thumb reveal opacity only in the ImageUploader files (D-05)', async () => {
    const reveal =
      'group/thumb opacity-0 group-hover/thumb:opacity-100 group-focus-within/thumb:opacity-100 no-hover:opacity-100';
    expect(await findingsOf('src/components/media/ImageUploader.tsx', jsx(reveal))).toEqual([]);
    expect(await findingsOf('src/components/media/ImageUploader.recipe.ts', `export const r = '${reveal}';`)).toEqual(
      [],
    );
    expect(await findingsOf('src/components/Other.tsx', jsx(reveal))).toEqual([
      ['opacity-0', 'opacity'],
      ['group-hover/thumb:opacity-100', 'opacity'],
      ['group-focus-within/thumb:opacity-100', 'opacity'],
      ['no-hover:opacity-100', 'opacity'],
    ]);
  });

  it('names the file, line, token and reason in each finding', async () => {
    const file = 'src/components/A.tsx';
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

// TOOL-WR-06: a class string held in a variable is read where the variable is declared, so the gate sees it.
describe('class strings held in variables (TOOL-WR-06)', () => {
  it('reads a same-file const used as a className', () => {
    const source = "const x = 'bg-blue-500';\nexport const A = () => <div className={x} />;\n";
    expect(collectClassTokens('src/components/A.tsx', source)).toEqual([{ token: 'bg-blue-500', line: 1 }]);
  });

  it('reads consts in both branches of a conditional className and in clsx arguments', () => {
    const source = [
      "import clsx from 'clsx';",
      "const on = 'p-4';",
      "const off = 'bg-blue-500';",
      'export const A = (o: { on: boolean }) => <div className={o.on ? on : off} />;',
      "export const B = (o: { on: boolean }) => <div className={clsx('flex', o.on && on)} />;",
    ].join('\n');
    expect(tokensOf('src/components/A.tsx', source)).toEqual(['p-4', 'bg-blue-500', 'flex']);
  });

  it('follows a const that names another const, and stops on a cycle', () => {
    const source = [
      "const base = 'm-1';",
      'const alias = base;',
      'const a: string = b;',
      'const b: string = a;',
      'export const A = () => <div className={alias} />;',
      'export const B = () => <div className={a} />;',
    ].join('\n');
    expect(tokensOf('src/components/A.tsx', source)).toEqual(['m-1']);
  });

  it('reads nothing for a prop or parameter passed through', () => {
    const source = 'export const A = ({ className }: { className: string }) => <div className={className} />;';
    expect(tokensOf('src/components/A.tsx', source)).toEqual([]);
  });

  it('fails an unknown class held in a const', async () => {
    const source = "const x = 'p-4 bg-blue-500';\nexport const A = () => <div className={x} />;\n";
    expect(await findingsOf('src/components/A.tsx', source)).toEqual([['bg-blue-500', 'unknown']]);
  });
});

describe('runClassGate: class strings imported from another module (TOOL-WR-06)', () => {
  let root = '';
  afterEach(() => {
    if (root !== '') {
      rmSync(root, { recursive: true, force: true });
      root = '';
    }
  });

  function project(files: Record<string, string>): string {
    root = mkdtempSync(path.join(tmpdir(), 'csps-class-gate-'));
    for (const [file, text] of Object.entries(files)) {
      mkdirSync(path.dirname(path.join(root, file)), { recursive: true });
      writeFileSync(path.join(root, file), text);
    }
    return root;
  }

  it('reads a class const exported by a plain module (through a barrel) and reports it in that module', async () => {
    const webRoot = project({
      'src/components/copy.ts': "export const panelClasses = 'p-4 bg-blue-500';\n",
      'src/components/index.ts': "export { panelClasses } from './copy';\n",
      'src/modules/public/pages/Page.tsx':
        "import { panelClasses } from '@/components';\nexport const Page = () => <div className={panelClasses} />;\n",
    });
    const findings = await runClassGate(webRoot);
    expect(findings.map((finding) => [finding.file, finding.line, finding.token, finding.kind])).toEqual([
      ['src/components/copy.ts', 1, 'bg-blue-500', 'unknown'],
    ]);
  });

  it('does not read a recipe const twice', async () => {
    const webRoot = project({
      'src/components/a.recipe.ts': "export const aClasses = 'p-4 bg-blue-500';\n",
      'src/modules/public/pages/Page.tsx':
        "import { aClasses } from '../ui/a.recipe';\nexport const Page = () => <div className={aClasses} />;\n",
    });
    expect((await runClassGate(webRoot)).map((finding) => [finding.file, finding.token])).toEqual([
      ['src/components/a.recipe.ts', 'bg-blue-500'],
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

  it.each([
    ['bg-[hsl(0_0%_50%)]'],
    ['text-[hsla(0,0%,50%,.5)]'],
    ['text-[hwb(0_0%_0%)]'],
    ['bg-[lab(50%_40_59)]'],
    ['bg-[lch(50%_40_59)]'],
    ['bg-[oklab(0.5_0.1_0.1)]'],
    ['bg-[color(display-p3_1_0_0)]'],
    ['bg-[red]'],
    ['text-[color:tomato]'],
    ['border-[RebeccaPurple]'],
    ['[background-color:navy]'],
    ['bg-[color-mix(in_srgb,red_50%,var(--bg))]'],
    ['BG-[#FFF]'],
    ['bg-[RGB(1,2,3)]'],
  ])('the colour-literal pattern catches %s (TOOL-WR-07)', (token) => {
    expect(COLOUR_LITERAL.test(token)).toBe(true);
  });

  it.each([
    ['bg-(--color-red)'],
    ['text-[var(--red)]'],
    ['w-[calc(tan(45deg)*1rem)]'],
    ['in-data-[ui=s-toolbar]:p-2'],
    ['border-[transparent]'],
    ['fill-[currentColor]'],
    ['text-red'],
    ['bg-[color-mix(in_srgb,var(--surface)_60%,transparent)]'],
  ])('the colour-literal pattern leaves %s alone', (token) => {
    expect(COLOUR_LITERAL.test(token)).toBe(false);
  });

  it('shares its pattern source with the ESLint rule', () => {
    expect(COLOUR_LITERAL.source).toBe(COLOUR_LITERAL_SOURCE);
  });
});

describe('the real source', () => {
  it('lists src files without tests, src/test or declaration files', () => {
    const files = listSourceFiles();
    expect(files).toContain('src/main.tsx');
    expect(files).toContain('src/modules/public/pages/PublicPlaceholderPage.tsx');
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

  // It compiles every token in src one by one: under 1 s alone, but past the 5 s default while the full coverage run
  // loads every core (it timed out at 5 s in plan 02-25's verify run), so it gets its own 30 s budget. Same check.
  it(
    'every class token in src compiles, with no colour literal and no stray opacity',
    { timeout: 30_000 },
    async () => {
      expect(await runClassGate()).toEqual([]);
    },
  );
});

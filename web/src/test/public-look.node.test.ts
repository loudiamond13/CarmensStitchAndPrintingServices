// @vitest-environment node
// Gates for the public look (11-UI-REVIEW): named font sizes, token colours, no style attribute, the safe area under the bar.
// A node test, because the class gate reads app.css with node:fs.
import { readdirSync, readFileSync } from 'node:fs';
import { join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { buildCss } from '../../scripts/class-gate.mjs';

const srcDir = fileURLToPath(new URL('../', import.meta.url));
const publicDir = join(srcDir, 'modules', 'public');

// The 11-UI-SPEC Typography sizes plus App. C `.s-social` 15 and `.s-hero-num` 160 and 260.
const SIZES = [12, 13, 14, 15, 16, 18, 20, 22, 24, 28, 30, 32, 36, 40, 48, 52, 56, 64, 76, 80, 96, 160, 260];

const filesUnder = (dir: string): string[] =>
  readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const path = join(dir, entry.name);
    return entry.isDirectory() ? filesUnder(path) : [path];
  });

/** Non-test .ts and .tsx files of the public module, as `path` and `source`. */
const publicSources = filesUnder(publicDir)
  .filter((path) => /\.tsx?$/.test(path) && !path.includes('.test.'))
  .map((path) => ({
    name: relative(srcDir, path).replaceAll('\\', '/'),
    source: readFileSync(path, 'utf8'),
  }));

/** `path:line` of every line in the public module that matches the pattern. */
function hitsOf(pattern: RegExp, only: (name: string) => boolean = () => true): string[] {
  return publicSources
    .filter(({ name }) => only(name))
    .flatMap(({ name, source }) =>
      source.split(/\r?\n/).flatMap((line, index) => (pattern.test(line) ? [`${name}:${String(index + 1)}`] : [])),
    );
}

const appCss = readFileSync(join(srcDir, 'ui', 'app.css'), 'utf8');
const baseCss = readFileSync(join(srcDir, 'ui', 'base.css'), 'utf8');

describe('public type scale (11-UI-REVIEW fix 1)', () => {
  it('declares exactly the pinned --text-N tokens, each N px, with no line-height companion', () => {
    const declared = [...appCss.matchAll(/--text-(\d+):\s*([^;]+);/g)].map((m) => [Number(m[1]), m[2]]);
    expect(declared).toEqual(SIZES.map((n) => [n, `${String(n)}px`]));
    expect(appCss).not.toMatch(/--text-[\w-]*--line-height/);
  });

  it('holds no hand-typed font size or weight in the public module', () => {
    expect(hitsOf(/(?<![\w-])(?:[\w-]+:)*(?:text-\[[\d.]+(?:px|rem|em)\]|font-\[\d+\])/)).toEqual([]);
  });

  it('uses only text-N utilities that name a pinned size', () => {
    const used = publicSources.flatMap(({ source }) =>
      [...source.matchAll(/(?<![\w-])(?:[\w-]+:)*text-(\d+)(?![\w-])/g)].map((m) => Number(m[1])),
    );
    expect(used.length).toBeGreaterThan(0);
    expect(used.filter((n) => !SIZES.includes(n))).toEqual([]);
  });

  it('compiles text-14 to font-size only, so the look equals the old hand-typed size', async () => {
    const css = await buildCss(['text-14']);
    expect(css).toContain('font-size: var(--text-14)');
    const rule = css.slice(css.indexOf('.text-14'), css.indexOf('}', css.indexOf('.text-14')));
    expect(rule).not.toContain('line-height');
  });
});

describe('public colours (11-UI-REVIEW fix 2)', () => {
  it('holds no hex colour in public TSX except the hero and jersey art', () => {
    expect(
      hitsOf(
        /#[0-9a-fA-F]{8}\b|#[0-9a-fA-F]{6}\b|#[0-9a-fA-F]{3,4}\b/,
        (name) => name.endsWith('.tsx') && !/\/(HeroArt|JerseyArt)\.tsx$/.test(name),
      ),
    ).toEqual([]);
  });

  it('keeps the Blush tokens equal to the values the drawn map used', () => {
    const blush = baseCss.slice(0, baseCss.indexOf('}'));
    const roads: Record<string, string> = {
      '--surface-3': '#fff6f0',
      '--surface': '#fbebe2',
      '--neutral-soft': '#ead1c4',
      '--nav-bg': '#d4bbab',
    };
    for (const [token, hex] of Object.entries(roads)) {
      expect(blush, token).toMatch(new RegExp(`${token}:\\s*${hex}\\b`, 'i'));
    }
  });
});

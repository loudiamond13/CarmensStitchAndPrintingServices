// @vitest-environment node
// Gates for the public look (11-UI-REVIEW): named font sizes and spacing, token colours, no style attribute, the safe area under the bar.
// A node test, because the class gate reads app.css with node:fs.
import { readdirSync, readFileSync } from 'node:fs';
import { join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { buildCss } from '../../scripts/class-gate.mjs';
import { barClasses, barPrimaryClasses, barSecondaryClasses } from '../modules/public/components/contact.recipe';
import {
  articleClasses,
  articleGridClasses,
  noticeClasses,
  noticeLabelClasses,
  noticeSmallClasses,
  tocWideClasses,
} from '../modules/public/components/legal.recipe';

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

describe('public strict CSP (11-UI-REVIEW fix 3)', () => {
  it('sets no style attribute in the public module', () => {
    expect(hitsOf(/\bstyle=\{/, (name) => name.endsWith('.tsx'))).toEqual([]);
  });
});

describe('public sticky bar (11-UI-REVIEW fix 6)', () => {
  it('pads the bar bottom by 16px plus the device safe area', async () => {
    const tokens = barClasses.split(/\s+/).filter((token) => token.startsWith('pb-'));
    expect(tokens).toHaveLength(1);
    const css = await buildCss(tokens);
    expect(css).toContain('padding-bottom: calc(16px + env(safe-area-inset-bottom))');
  });
});

const CLEARANCE = 'pg-phone:pb-[max(var(--space-24),calc(var(--spacing-contact-bar)+env(safe-area-inset-bottom)))]';
const footerSource = publicSources.find(({ name }) => name.endsWith('/SiteFooter.tsx'))?.source ?? '';
const layoutSource = readFileSync(join(srcDir, 'layouts', 'PublicLayout.tsx'), 'utf8');
const compact = (css: string) => css.replaceAll(/\s+/g, '');

describe('public spacing tokens (11-UI-REVIEW N-02)', () => {
  it('pins --spacing-contact-bar to the sum of the bar parts', () => {
    const token = /--spacing-contact-bar:\s*(\d+)px;/.exec(appCss);
    const top = /(?<![\w-])pt-(\d+)(?![\w-])/.exec(barClasses);
    const button = /(?<![\w-])h-(\d+)(?![\w-])/.exec(barSecondaryClasses);
    const bottom = /(?<![\w-])pb-\[calc\((\d+)px\+env\(safe-area-inset-bottom\)\)\]/.exec(barClasses);
    expect(token).not.toBeNull();
    expect(top).not.toBeNull();
    expect(button).not.toBeNull();
    expect(bottom).not.toBeNull();
    expect(barClasses.split(/\s+/)).toContain('border-t');
    const sum = 1 + 4 * Number(top?.[1]) + 4 * Number(button?.[1]) + Number(bottom?.[1]);
    expect(Number(token?.[1])).toBe(sum);
  });

  it('gives both bar buttons the same 48px button shape, so either bar is as tall as the token', () => {
    const shape = ['inline-flex', 'h-12', 'items-center', 'justify-center', 'gap-2', 'rounded-sm', 'border', 'px-3'];
    for (const classes of [barPrimaryClasses, barSecondaryClasses]) {
      expect(classes.split(/\s+/)).toEqual(expect.arrayContaining(shape));
    }
  });

  it('holds no bare px padding or margin in the public module', () => {
    expect(hitsOf(/(?<![\w-])-?[pm][xytrblse]?-\[[\d.]+px\]/)).toEqual([]);
  });

  it('clears the Contact bar under both footers with one shared class, 96px while the inset is 0', async () => {
    expect(footerSource.split(CLEARANCE)).toHaveLength(2);
    const css = compact(await buildCss([CLEARANCE]));
    expect(css).toContain(
      'padding-bottom:max(var(--space-24),calc(var(--spacing-contact-bar)+env(safe-area-inset-bottom)))',
    );
    expect(css).toContain('--spacing-contact-bar:77px');
    expect(baseCss).toMatch(/--space-24:\s*96px/);
  });

  it('holds no hand-typed bar height in an arbitrary value', () => {
    const typed = /\[[^\]\s]*\b77px/;
    expect(hitsOf(typed)).toEqual([]);
    expect(typed.test(layoutSource)).toBe(false);
  });

  it('names the footer tagline width as --spacing-tagline, 320px', async () => {
    expect(appCss).toMatch(/--spacing-tagline:\s*320px;/);
    expect(footerSource).not.toMatch(/(?<![\w-])max-w-\[[\d.]+px\]/);
    expect(footerSource).toContain('max-w-tagline');
    const css = compact(await buildCss(['max-w-tagline']));
    expect(css).toContain('max-width:var(--spacing-tagline)');
    expect(css).toContain('--spacing-tagline:320px');
  });
});

describe('public copy (11-UI-REVIEW N-01)', () => {
  it('names nothing with a string-literal aria-label in public TSX: labels come from the copy module', () => {
    expect(hitsOf(/aria-label=(?:"|\{\s*['"`])/, (name) => name.endsWith('.tsx'))).toEqual([]);
  });
});

const legalRecipe = publicSources.find(({ name }) => name.endsWith('/legal.recipe.ts'))?.source ?? '';

/** The WCAG relative luminance of a #rrggbb colour. */
function luminance(hex: string): number {
  const [r = 0, g = 0, b = 0] = [1, 3, 5].map((at) => {
    const channel = parseInt(hex.slice(at, at + 2), 16) / 255;
    return channel <= 0.03928 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

function contrast(a: string, b: string): number {
  const [hi = 0, lo = 0] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
}

/** A #rrggbb token of the light block of base.css, which comes before the dark block. */
function lightToken(name: string): string {
  const light = baseCss.slice(0, baseCss.indexOf('[data-theme="dark"]'));
  return new RegExp(`${name}:\\s*(#[0-9a-fA-F]{6});`).exec(light)?.[1] ?? '';
}

describe('legal page look (12-UI-REVIEW)', () => {
  it('names the reading width as --spacing-reading, 640px', async () => {
    expect(appCss).toMatch(/--spacing-reading:\s*640px;/);
    expect(legalRecipe).not.toMatch(/\[[^\]]*640px[^\]]*\]/);
    const css = compact(await buildCss(['max-w-reading']));
    expect(css).toContain('max-width:var(--spacing-reading)');
    expect(css).toContain('--spacing-reading:640px');
  });

  it('gives the DRAFT notice and the article the reading width token', () => {
    expect(noticeClasses.split(/\s+/)).toContain('max-w-reading');
    expect(articleClasses.split(/\s+/)).toContain('max-w-reading');
  });

  it('uses the reading width token as the article column of the grid', async () => {
    expect(articleGridClasses).toContain('grid-cols-[240px_minmax(0,var(--spacing-reading))]');
    const css = compact(await buildCss(['grid-cols-[240px_minmax(0,var(--spacing-reading))]']));
    expect(css).toContain('grid-template-columns:240pxminmax(0,var(--spacing-reading))');
  });

  it('bounds the wide table of contents to the viewport under its sticky offset and scrolls it', async () => {
    const css = compact(await buildCss(tocWideClasses.split(/\s+/)));
    const offset = /top:calc\(([^;]+)\);/.exec(css)?.[1];
    expect(offset).toBe('var(--header-height)+var(--space-6)-var(--space-1)');
    expect(css).toContain('max-height:calc(100dvh-var(--header-height)-var(--space-6)+var(--space-1))');
    expect(css).toContain('overflow-y:auto');
    expect(css).toContain('overscroll-behavior:contain');
  });

  it('pads the wide table of contents by the focus ring width and takes it back with a margin, so no ring is clipped', async () => {
    const tokens = tocWideClasses.split(/\s+/);
    expect(tokens).toEqual(expect.arrayContaining(['-m-1', 'p-1']));
    const css = compact(await buildCss(['-m-1', 'p-1']));
    expect(css).toContain('margin:calc(var(--spacing)*-1)');
    expect(css).toContain('padding:var(--spacing)');
    expect(css).toContain('--spacing:4px');
    // The ring is a 2px outline 2px out (base.css): 4px, which is also --space-1 in the sticky offset.
    expect(baseCss).toMatch(/:focus-visible\s*\{\s*outline:\s*2px[^;]*;\s*outline-offset:\s*2px;/);
    expect(baseCss).toMatch(/--space-1:\s*4px/);
  });

  it('keeps the DRAFT notice text at least 4.5:1 on its ground (guard)', () => {
    expect(noticeClasses.split(/\s+/)).toContain('bg-warning-soft');
    expect(noticeLabelClasses.split(/\s+/)).toContain('text-ink');
    expect(noticeSmallClasses.split(/\s+/)).toContain('text-ink-muted');
    const ground = lightToken('--warning-soft');
    expect(contrast(lightToken('--ink-muted'), ground)).toBeGreaterThanOrEqual(4.5);
    expect(contrast(lightToken('--ink'), ground)).toBeGreaterThanOrEqual(4.5);
  });
});

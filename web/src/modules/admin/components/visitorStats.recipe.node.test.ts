// @vitest-environment node
// The Visitor Stats recipe compiled against the CSPS theme (12.1-UI-REVIEW): named sizes, a one-column KPI row and the views bar
// token. jsdom evaluates no container query, so these tests read the generated CSS. A node test, because the class gate reads
// app.css with node:fs.
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { buildCss, checkClassTokens, collectClassTokens } from '../../../../scripts/class-gate.mjs';

const recipeFile = 'src/modules/admin/components/visitorStats.recipe.ts';
const recipeSource = readFileSync(new URL('./visitorStats.recipe.ts', import.meta.url), 'utf8');
const appCss = readFileSync(new URL('../../../ui/app.css', import.meta.url), 'utf8');
const baseCss = readFileSync(new URL('../../../ui/base.css', import.meta.url), 'utf8');
const recipeTokens = collectClassTokens(recipeFile, recipeSource);
const css = await buildCss([...new Set(recipeTokens.map((entry) => entry.token))]);

/** The class list of one `tw('...')` export, read from the recipe source. */
function classesOf(name: string): string {
  const match = new RegExp(String.raw`export const ${name} = tw\(\s*'([^']*)'`).exec(recipeSource);
  expect(match, name).not.toBeNull();
  return match?.[1] ?? '';
}

/** The CSS-escaped class selector of a token. */
function classSelector(token: string): string {
  return `.${token.replace(/[^a-zA-Z0-9_-]/g, (char) => `\\${char}`)}`;
}

/** The container block text that holds the rule of this token, or '' for a rule outside any container. */
function blockOf(token: string): string {
  const start = css.indexOf(classSelector(token));
  expect(start, token).toBeGreaterThanOrEqual(0);
  const container = css.lastIndexOf('@container pg', start);
  return container < 0 ? '' : css.slice(container, css.indexOf('{', container)).trim();
}

/** The value of a custom property inside one theme block of base.css. */
function tokenIn(block: string, name: string): string {
  return new RegExp(`${name}:\\s*(#[0-9a-fA-F]{6});`).exec(block)?.[1] ?? '';
}

const darkAt = baseCss.indexOf('[data-theme="dark"]');
const lightBlock = baseCss.slice(0, darkAt);
const darkBlock = baseCss.slice(darkAt);

describe('visitor stats recipe', () => {
  it('passes the class gate: every token compiles under the CSPS theme, with no finding', async () => {
    expect(recipeTokens.length).toBeGreaterThan(0);
    expect(await checkClassTokens(recipeTokens, { file: recipeFile })).toEqual([]);
  });

  it('holds no hand-typed pixel font size', () => {
    expect(recipeSource).not.toMatch(/text-\[\d+px\]/);
  });

  it.each(['statBarNameClasses', 'statBarFigureClasses', 'statBarEmptyClasses'])(
    'sets %s in the named 14px size',
    (name) => {
      expect(classesOf(name).split(/\s+/)).toContain('text-14');
    },
  );

  it('sets the KPI figure to the named 24px at 420px and below', () => {
    const token = 'pg-xs:[&_[data-kpi-value=normal]]:text-24';
    expect(recipeTokens.map((entry) => entry.token)).toContain(token);
    expect(blockOf(token)).toBe('@container pg (max-width: 420px)');
  });

  it('draws the KPI row as one column at every width, keeping the phone padding and no icon tile', () => {
    const classes = classesOf('visitorKpiRowClasses');
    expect(classes.split(/\s+/)).toContain('grid-cols-[minmax(0,1fr)]');
    expect(classes).not.toContain('repeat(');
    expect(classes).not.toContain('pg-tablet:grid-cols');
    expect(classes.split(/\s+/)).toEqual(
      expect.arrayContaining(['pg-phone:*:p-4', 'pg-phone:[&_[data-kpi-icon]]:hidden']),
    );
  });

  it('has no list row grid: the one list card sits straight in the page body', () => {
    expect(recipeSource).not.toContain('visitorStatsListRowClasses');
  });
});

describe('the views bar colour token', () => {
  it('fills the bar with bg-chart-views, which reads var(--chart-views)', () => {
    expect(classesOf('statBarFillClasses').split(/\s+/)).toContain('bg-chart-views');
    expect(css.replaceAll(/\s+/g, '')).toContain('background-color:var(--chart-views)');
  });

  it('maps --color-chart-views to --chart-views in the inline theme', () => {
    expect(appCss).toContain('--color-chart-views: var(--chart-views);');
  });

  it('declares --chart-views equal to --chart-expense in the light and the dark block', () => {
    expect(tokenIn(lightBlock, '--chart-views')).not.toBe('');
    expect(tokenIn(lightBlock, '--chart-views')).toBe(tokenIn(lightBlock, '--chart-expense'));
    expect(tokenIn(darkBlock, '--chart-views')).not.toBe('');
    expect(tokenIn(darkBlock, '--chart-views')).toBe(tokenIn(darkBlock, '--chart-expense'));
  });
});

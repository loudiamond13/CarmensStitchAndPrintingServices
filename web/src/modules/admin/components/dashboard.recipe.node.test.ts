// @vitest-environment node
// The dashboard recipe compiled against the CSPS theme (plan 10-09; UI-SPEC D1: the KPI row is 4 columns, 2 x 2 up to 1023px, and on
// phones the cards take 16px padding and lose their icon tile). jsdom evaluates no container query, so these tests read the
// generated CSS. A node test, because the class gate reads app.css with node:fs.
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { buildCss, checkClassTokens, collectClassTokens } from '../../../../scripts/class-gate.mjs';

const recipeFile = 'src/modules/admin/components/dashboard.recipe.ts';
const recipeTokens = collectClassTokens(
  recipeFile,
  readFileSync(new URL('./dashboard.recipe.ts', import.meta.url), 'utf8'),
);
const kpiTokens = collectClassTokens(
  'src/components/money/money.recipe.ts',
  readFileSync(new URL('../../../components/money/money.recipe.ts', import.meta.url), 'utf8'),
);
const css = await buildCss([...new Set([...kpiTokens, ...recipeTokens].map((entry) => entry.token))]);

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

describe('dashboard recipe', () => {
  it('passes the class gate: every token compiles under the CSPS theme, with no finding', async () => {
    expect(recipeTokens.length).toBeGreaterThan(0);
    expect(await checkClassTokens(recipeTokens, { file: recipeFile })).toEqual([]);
  });

  it('draws the KPI row as 4 columns, 2 columns up to 1023px, and tightens the gap on phones', () => {
    expect(css).toContain('grid-template-columns: repeat(4,minmax(0,1fr))');
    expect(blockOf('pg-lt-lg:grid-cols-[repeat(2,minmax(0,1fr))]')).toBe('@container pg (max-width: 1023px)');
    expect(blockOf('pg-phone:gap-3')).toBe('@container pg (max-width: 767px)');
  });

  it('sets the KPI figure to 24px at 420px and below, except the long-figure clamp (UI-SPEC: stat / KPI value 24 at <=420)', () => {
    const token = 'pg-xs:[&_[data-kpi-value=normal]]:text-[24px]';
    expect(recipeTokens.map((entry) => entry.token)).toContain(token);
    expect(blockOf(token)).toBe('@container pg (max-width: 420px)');
    expect(css).toContain('[data-kpi-value=normal]');
  });

  it('gives the cards 16px padding and hides the icon tile on phones, after the card own 20px padding', () => {
    expect(blockOf('pg-phone:*:p-4')).toBe('@container pg (max-width: 767px)');
    expect(blockOf('pg-phone:[&_[data-kpi-icon]]:hidden')).toBe('@container pg (max-width: 767px)');
    expect(css).toContain('[data-kpi-icon]');
    expect(css).not.toContain('size-8\\]');
    expect(css.indexOf(classSelector('pg-phone:*:p-4'))).toBeGreaterThan(css.indexOf('.p-5'));
  });
});

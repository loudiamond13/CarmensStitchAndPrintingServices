// @vitest-environment node
// The dashboard recipe compiled against the CSPS theme (plan 10-09; UI-SPEC D1: the KPI row is 4 columns, 2 x 2 up to 1023px, and on
// phones the cards take 16px padding and lose their icon tile). jsdom evaluates no container query, so these tests read the
// generated CSS. A node test, because the class gate reads app.css with node:fs.
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { buildCss, checkClassTokens, collectClassTokens } from '../../../../scripts/class-gate.mjs';

const recipeFile = 'src/modules/admin/components/dashboard.recipe.ts';
const recipeSource = readFileSync(new URL('./dashboard.recipe.ts', import.meta.url), 'utf8');
const recipeTokens = collectClassTokens(recipeFile, recipeSource);
const kpiTokens = collectClassTokens(
  'src/components/money/money.recipe.ts',
  readFileSync(new URL('../../../components/money/money.recipe.ts', import.meta.url), 'utf8'),
);
const css = await buildCss([...new Set([...kpiTokens, ...recipeTokens].map((entry) => entry.token))]);

/** The class list of one `tw('...')` export, read from the recipe source (the recipe itself pulls in components, which a node test does not load). */
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

  it('stacks the KPI cards in one column at 420px and below, after the 2-column rule so it wins (D-107)', () => {
    const token = 'pg-xs:grid-cols-[minmax(0,1fr)]';
    expect(recipeTokens.map((entry) => entry.token)).toContain(token);
    expect(blockOf(token)).toBe('@container pg (max-width: 420px)');
    expect(css.slice(css.indexOf(classSelector(token)))).toMatch(/^[^}]*grid-template-columns: minmax\(0,1fr\)/);
    expect(css.indexOf(classSelector(token))).toBeGreaterThan(
      css.indexOf(classSelector('pg-lt-lg:grid-cols-[repeat(2,minmax(0,1fr))]')),
    );
  });

  it('puts 8px under the status list head and keeps the 20px sides and bottom and the 12px row gap (App. C .s-status-list)', () => {
    const tokens = classesOf('statusListClasses').split(/\s+/);
    expect(tokens).toContain('pt-2');
    expect(tokens).not.toContain('pt-4');
    expect(tokens).toEqual(expect.arrayContaining(['px-5', 'pb-5', 'gap-3']));
  });

  it('dims the chart empty state by colour only while the other range loads (D-107, D-02)', () => {
    expect(classesOf('chartEmptyClasses').split(/\s+/)).toContain('data-[refetching=true]:bg-surface-2');
    expect(classesOf('chartEmptyClasses')).not.toContain('opacity');
  });

  it('dims a refetching chart by colour only: --surface-2 on the body, never an opacity (D-02)', () => {
    const token = 'data-[refetching=true]:bg-surface-2';
    expect(recipeTokens.map((entry) => entry.token)).toContain(token);
    expect(css).toContain(`${classSelector(token)}[data-refetching="true"]`);
    expect(css.slice(css.indexOf(classSelector(token)))).toMatch(/^[^}]*background-color: var\(--surface-2\)/);
    expect(recipeTokens.some((entry) => entry.token.includes('opacity'))).toBe(false);
  });

  it('gives the cards 16px padding and hides the icon tile on phones, after the card own 20px padding', () => {
    expect(blockOf('pg-phone:*:p-4')).toBe('@container pg (max-width: 767px)');
    expect(blockOf('pg-phone:[&_[data-kpi-icon]]:hidden')).toBe('@container pg (max-width: 767px)');
    expect(css).toContain('[data-kpi-icon]');
    expect(css).not.toContain('size-8\\]');
    expect(css.indexOf(classSelector('pg-phone:*:p-4'))).toBeGreaterThan(css.indexOf('.p-5'));
  });
});

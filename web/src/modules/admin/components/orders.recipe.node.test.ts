// @vitest-environment node
// The orders recipe compiled against the CSPS theme (plan 08-06; UI-SPEC L1 grid: 4 columns, 3 up to 1279px, 2 up to 1023px, 1 on
// phones). jsdom evaluates no container query, and Tailwind emits the page-container variants phone, tablet, then up to 1023px, then
// up to 1279px, so the widest rule would win on a phone if the narrower ones were not important. These tests read the generated
// CSS. A node test, because the class gate reads app.css with node:fs.
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { buildCss, checkClassTokens, collectClassTokens } from '../../../../scripts/class-gate.mjs';

const recipeFile = 'src/modules/admin/components/orders.recipe.ts';
const recipeSource = readFileSync(new URL('./orders.recipe.ts', import.meta.url), 'utf8');
const recipeTokens = collectClassTokens(recipeFile, recipeSource);
const css = await buildCss([...new Set(recipeTokens.map((entry) => entry.token))]);

/** The CSS-escaped class selector of a token. */
function classSelector(token: string): string {
  return `.${token.replace(/[^a-zA-Z0-9_-]/g, (char) => `\\${char}`)}`;
}

/** The text of the container block that holds the rule of this token, and the rule's own body. */
function ruleOf(token: string): { block: string; body: string } {
  const start = css.indexOf(classSelector(token));
  expect(start, token).toBeGreaterThanOrEqual(0);
  const container = css.lastIndexOf('@container pg', start);
  return {
    block: container < 0 ? '' : css.slice(container, css.indexOf('{', container)),
    body: css.slice(css.indexOf('{', start), css.indexOf('}', start)),
  };
}

const TABLET = 'pg-tablet:grid-cols-[repeat(2,minmax(0,1fr))]!';
const PHONE = 'pg-phone:grid-cols-[minmax(0,1fr)]!';
const LAPTOP = 'pg-lt-xl:grid-cols-[repeat(3,minmax(0,1fr))]';

describe('orders recipe (L1 grid)', () => {
  it('passes the class gate: every recipe token compiles under the CSPS theme, with no finding', async () => {
    expect(recipeTokens.length).toBeGreaterThan(0);
    expect(await checkClassTokens(recipeTokens, { file: recipeFile })).toEqual([]);
  });

  it('puts each column count in its page container width', () => {
    expect(ruleOf(LAPTOP).block).toBe('@container pg (max-width: 1279px) ');
    expect(ruleOf(TABLET).block).toBe('@container pg (min-width: 768px) and (max-width: 1023px) ');
    expect(ruleOf(PHONE).block).toBe('@container pg (max-width: 767px) ');
  });

  it('makes the tablet and phone counts important, so the wider 3-column rule cannot win over them', () => {
    expect(ruleOf(TABLET).body).toContain('!important');
    expect(ruleOf(PHONE).body).toContain('!important');
    expect(ruleOf(LAPTOP).body).not.toContain('!important');
  });

  it('dims the cards of a refetching grid to --surface-2 by colour only (D-02)', () => {
    const token = 'data-[refetching=true]:[&_article]:bg-surface-2';
    const rule = ruleOf(token);
    expect(css).toContain(`${classSelector(token)}[data-refetching="true"] article`);
    expect(rule.body).toContain('background-color: var(--surface-2)');
    expect(recipeTokens.filter((entry) => entry.token.includes('opacity'))).toEqual([]);
  });
});

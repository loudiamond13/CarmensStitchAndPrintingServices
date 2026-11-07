// @vitest-environment node
// The money recipe compiled against the CSPS theme (plan 10-13; UI-SPEC D1 MoneyStrip phones rule and the overflow rows): on phones
// the wallet tile is hidden and the buttons take their own row; a very large figure stays on one line; the My Money figure of 15
// characters or more shrinks with the card. jsdom evaluates no container query, so these tests read the generated CSS. A node test,
// because the class gate reads app.css with node:fs.
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { buildCss, checkClassTokens, collectClassTokens } from '../../../../scripts/class-gate.mjs';

const recipeFile = 'src/modules/admin/components/money.recipe.ts';
const recipeTokens = collectClassTokens(
  recipeFile,
  readFileSync(new URL('./money.recipe.ts', import.meta.url), 'utf8'),
);
const css = await buildCss([...new Set(recipeTokens.map((entry) => entry.token))]);

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

/** The declarations of the rule of this token, up to its closing brace. */
function ruleOf(token: string): string {
  const start = css.indexOf(classSelector(token));
  expect(start, token).toBeGreaterThanOrEqual(0);
  return css.slice(start, css.indexOf('}', start));
}

describe('money recipe', () => {
  it('passes the class gate: every token compiles under the CSPS theme, with no finding', async () => {
    expect(recipeTokens.length).toBeGreaterThan(0);
    expect(await checkClassTokens(recipeTokens, { file: recipeFile })).toEqual([]);
  });

  it('hides the wallet tile at 767px and below', () => {
    expect(blockOf('pg-phone:hidden')).toBe('@container pg (max-width: 767px)');
    expect(ruleOf('pg-phone:hidden')).toContain('display: none');
  });

  it('gives the buttons their own full-width row on phones, sharing it equally, and drops the push to the right', () => {
    expect(blockOf('pg-phone:w-full')).toBe('@container pg (max-width: 767px)');
    expect(blockOf('pg-phone:*:flex-1')).toBe('@container pg (max-width: 767px)');
    expect(blockOf('pg-phone:ml-0')).toBe('@container pg (max-width: 767px)');
    expect(css.indexOf(classSelector('pg-phone:ml-0'))).toBeGreaterThan(css.indexOf('.ml-auto'));
  });

  it('wraps the strip and keeps the strip figure on one line', () => {
    expect(ruleOf('flex-wrap')).toContain('flex-wrap: wrap');
    expect(ruleOf('whitespace-nowrap')).toContain('white-space: nowrap');
  });

  it('shrinks a very large My Money figure with the card width, and the clamp wins over the large size', () => {
    const token = 'text-[length:clamp(22px,13.5cqi,40px)]!';
    expect(recipeTokens.map((entry) => entry.token)).toContain(token);
    expect(ruleOf(token)).toContain('font-size: clamp(22px, 13.5cqi, 40px)');
    expect(ruleOf(token)).toContain('!important');
  });

  it('makes the card body the container its figure measures', () => {
    expect(recipeTokens.map((entry) => entry.token)).toContain('@container');
    expect(css).toContain('container-type: inline-size');
  });

  it('dims by colour only: no opacity token', () => {
    expect(recipeTokens.some((entry) => entry.token.includes('opacity'))).toBe(false);
  });
});

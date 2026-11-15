// @vitest-environment node
// The Site Content recipe compiled against the CSPS theme (plan 11-12; UI-SPEC S1 card 3: the phone row is `1fr 160px auto auto` and
// stacks on phones). jsdom evaluates no container query, so these tests read the generated CSS. A node test, because the class gate
// reads app.css with node:fs.
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { buildCss, checkClassTokens, collectClassTokens } from '../../../../scripts/class-gate.mjs';

const recipeFile = 'src/modules/admin/components/siteContent.recipe.ts';
const recipeSource = readFileSync(new URL('./siteContent.recipe.ts', import.meta.url), 'utf8');
const recipeTokens = collectClassTokens(recipeFile, recipeSource);
const css = await buildCss([...new Set(recipeTokens.map((entry) => entry.token))]);

/** The CSS-escaped class selector of a token. */
function classSelector(token: string): string {
  return `.${token.replace(/[^a-zA-Z0-9_-]/g, (char) => `\\${char}`)}`;
}

/** The text of the container block that holds the rule of this token. */
function blockOf(token: string): string {
  const start = css.indexOf(classSelector(token));
  expect(start, token).toBeGreaterThanOrEqual(0);
  const container = css.lastIndexOf('@container pg', start);
  return container < 0 ? '' : css.slice(container, css.indexOf('{', container));
}

describe('siteContent recipe', () => {
  it('passes the class gate: every recipe token compiles under the CSPS theme, with no finding', async () => {
    expect(recipeTokens.length).toBeGreaterThan(0);
    expect(await checkClassTokens(recipeTokens, { file: recipeFile })).toEqual([]);
  });

  it('draws the phone row as four columns and stacks it in the phone page container', () => {
    expect(css).toContain('minmax(0,1fr) 160px auto 44px');
    expect(blockOf('pg-phone:grid-cols-[minmax(0,1fr)_44px]')).toBe('@container pg (max-width: 767px) ');
    expect(blockOf('pg-phone:col-span-2')).toBe('@container pg (max-width: 767px) ');
    expect(blockOf('pg-phone:pt-0')).toBe('@container pg (max-width: 767px) ');
  });

  it('draws a day row of the hours card as a 160px day column and two shares, and stacks it in the phone page container (plan 11-16)', () => {
    expect(css).toContain('160px minmax(0,1fr) minmax(0,1fr)');
    expect(blockOf('pg-phone:grid-cols-2')).toBe('@container pg (max-width: 767px) ');
    expect(blockOf('pg-phone:col-span-2')).toBe('@container pg (max-width: 767px) ');
  });
});

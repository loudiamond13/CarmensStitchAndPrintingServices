// @vitest-environment node
// The order page recipe compiled against the CSPS theme (plan 08-10; UI-SPEC O1 layout: main and a 360px side, a 320px side up to
// 1279px, one column up to 1023px with the side first). jsdom evaluates no container query, and Tailwind emits the page-container
// variants up to 1023px before the one up to 1279px, so the later rule would win on a tablet if the one-column rule were not
// important. These tests read the generated CSS. A node test, because the class gate reads app.css with node:fs.
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { buildCss, checkClassTokens, collectClassTokens } from '../../../../scripts/class-gate.mjs';

const recipeFile = 'src/modules/admin/components/orderPage.recipe.ts';
const recipeSource = readFileSync(new URL('./orderPage.recipe.ts', import.meta.url), 'utf8');
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

const ONE_COLUMN = 'pg-lt-lg:grid-cols-[minmax(0,1fr)]!';
const NARROW_SIDE = 'pg-lt-xl:grid-cols-[minmax(0,1fr)_320px]';
const SIDE_STATIC = 'pg-lt-lg:static';
const SIDE_FIRST = 'pg-tablet:order-first';
const SIDE_GRID = 'pg-tablet:grid-cols-2';
const STRIP_SHOWN = 'pg-phone:flex';
const TABLET_BLOCK = '@container pg (min-width: 768px) and (max-width: 1023px) ';
const PHONE_BLOCK = '@container pg (max-width: 767px) ';

describe('order page recipe (O1 layout)', () => {
  it('passes the class gate: every recipe token compiles under the CSPS theme, with no finding', async () => {
    expect(recipeTokens.length).toBeGreaterThan(0);
    expect(await checkClassTokens(recipeTokens, { file: recipeFile })).toEqual([]);
  });

  it('puts each layout rule in its page container width', () => {
    expect(ruleOf(ONE_COLUMN).block).toBe('@container pg (max-width: 1023px) ');
    expect(ruleOf(NARROW_SIDE).block).toBe('@container pg (max-width: 1279px) ');
    expect(ruleOf(SIDE_STATIC).block).toBe('@container pg (max-width: 1023px) ');
    expect(ruleOf(SIDE_FIRST).block).toBe(TABLET_BLOCK);
    expect(ruleOf(SIDE_GRID).block).toBe(TABLET_BLOCK);
    expect(ruleOf(STRIP_SHOWN).block).toBe(PHONE_BLOCK);
  });

  it('moves the side above the main column on a tablet only, so it follows the main column on a phone', () => {
    expect(ruleOf(SIDE_FIRST).body).toContain('order: -9999');
  });

  it('hides the slim balance card above 767px and shows it as a flex row on a phone', () => {
    expect(recipeSource).toContain(`hidden ${STRIP_SHOWN}`);
  });

  it('makes the one-column rule important, so the 320px side rule cannot win over it on a tablet', () => {
    expect(ruleOf(ONE_COLUMN).body).toContain('!important');
    expect(ruleOf(NARROW_SIDE).body).not.toContain('!important');
  });
});

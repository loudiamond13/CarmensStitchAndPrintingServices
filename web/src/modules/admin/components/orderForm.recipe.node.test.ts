// @vitest-environment node
// The order form recipe compiled against the CSPS theme (plan 08-13; UI-SPEC F1: the item grid, the save bar, the scroll padding).
// jsdom evaluates no container query, so these tests read the generated CSS. A node test, because the class gate reads app.css
// with node:fs.
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { buildCss, checkClassTokens, collectClassTokens } from '../../../../scripts/class-gate.mjs';

const recipeFile = 'src/modules/admin/components/orderForm.recipe.ts';
const recipeSource = readFileSync(new URL('./orderForm.recipe.ts', import.meta.url), 'utf8');
const recipeTokens = collectClassTokens(recipeFile, recipeSource);
const css = await buildCss([...new Set(recipeTokens.map((entry) => entry.token))]);

/** The CSS-escaped class selector of a token. */
function classSelector(token: string): string {
  return `.${token.replace(/[^a-zA-Z0-9_-]/g, (char) => `\\${char}`)}`;
}

/** The container (or media) block that holds the rule of this token, and the rule's own body. */
function ruleOf(token: string, at = '@container pg'): { block: string; body: string } {
  const start = css.indexOf(classSelector(token));
  expect(start, token).toBeGreaterThanOrEqual(0);
  const container = css.lastIndexOf(at, start);
  return {
    block: container < 0 ? '' : css.slice(container, css.indexOf('{', container)),
    body: css.slice(css.indexOf('{', start), css.indexOf('}', start)),
  };
}

const TABLET_BLOCK = '@container pg (min-width: 768px) and (max-width: 1023px) ';
const PHONE_BLOCK = '@container pg (max-width: 767px) ';

describe('order form recipe (F1 layout)', () => {
  it('passes the class gate: every recipe token compiles under the CSPS theme, with no finding', async () => {
    expect(recipeTokens.length).toBeGreaterThan(0);
    expect(await checkClassTokens(recipeTokens, { file: recipeFile })).toEqual([]);
  });

  it('puts the 6-column and 4-column item grids in their own widths, and makes them important over the 1279px grid', () => {
    expect(ruleOf('pg-tablet:grid-cols-6!').block).toBe(TABLET_BLOCK);
    expect(ruleOf('pg-tablet:grid-cols-6!').body).toContain('!important');
    expect(ruleOf('pg-phone:grid-cols-4!').block).toBe(PHONE_BLOCK);
    expect(ruleOf('pg-phone:grid-cols-4!').body).toContain('!important');
    expect(ruleOf('pg-lt-xl:grid-cols-[150px_minmax(0,1.4fr)_80px_64px_104px_100px_44px]').block).toBe(
      '@container pg (max-width: 1279px) ',
    );
  });

  it('hides the column header row at 1023px and below', () => {
    expect(ruleOf('pg-lt-lg:hidden').block).toBe('@container pg (max-width: 1023px) ');
  });

  it('makes the item controls 44px tall on phones (D-54b)', () => {
    for (const token of ['pg-phone:[&_input]:h-11', 'pg-phone:[&_select]:h-11']) {
      const rule = ruleOf(token);
      expect(rule.block).toBe(PHONE_BLOCK);
      expect(rule.body).toContain('var(--spacing)');
    }
  });

  it('shows the item labels below 1024px only', () => {
    expect(recipeSource).toContain('[&_label]:sr-only');
    expect(ruleOf('pg-lt-lg:[&_label]:not-sr-only').block).toBe('@container pg (max-width: 1023px) ');
  });

  it('pads the scroll for the save bar on this page only, with more room on phones for the tab bar (D-54d)', () => {
    // The selector names the page's data attribute, so it outranks the admin frame's own phone padding.
    const desktop = css.indexOf('scroll-padding-bottom: calc(76px + var(--space-6));');
    const phone = css.indexOf('scroll-padding-bottom: calc(71px + 112px + var(--space-6) + env(safe-area-inset-bottom));');
    expect(desktop).toBeGreaterThanOrEqual(0);
    // The phone rule sits in a viewport media query and comes after the desktop rule, so it wins on a phone.
    expect(phone).toBeGreaterThan(desktop);
    expect(css.lastIndexOf('@media (max-width: 767px)', phone)).toBeGreaterThan(desktop);
    for (const at of [desktop, phone]) {
      expect(css.slice(css.lastIndexOf(':root:has(', at), at)).toContain('[data-savebar]');
    }
  });

  it('keeps the save bar above the phone tab bar', () => {
    const bar = ruleOf('pg-phone:bottom-[calc(71px+env(safe-area-inset-bottom))]');
    expect(bar.block).toBe(PHONE_BLOCK);
    expect(bar.body).toContain('safe-area-inset-bottom');
  });
});

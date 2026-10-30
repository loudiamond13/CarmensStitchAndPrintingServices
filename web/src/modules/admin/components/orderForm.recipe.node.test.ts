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

const PHONE_BLOCK = '@container pg (max-width: 767px) ';

describe('order form recipe (F1 layout)', () => {
  it('passes the class gate: every recipe token compiles under the CSPS theme, with no finding', async () => {
    expect(recipeTokens.length).toBeGreaterThan(0);
    expect(await checkClassTokens(recipeTokens, { file: recipeFile })).toEqual([]);
  });

  it('reads the Items card width, not the page width, for the item grid (a card beside the aside is narrow)', () => {
    expect(css).toContain('container-name: items;');
    const columns = 'it-lg:grid-cols-[180px_minmax(0,1.6fr)_96px_76px_120px_112px_44px]';
    expect(ruleOf(columns, '@container items').block).toBe('@container items (min-width: 900px) ');
    expect(ruleOf('it-md:grid-cols-6', '@container items').block).toBe('@container items (min-width: 560px) ');
    // The two ranges meet at 900px with no gap between them: below 900px (not 899px), and from 900px.
    expect(ruleOf('it-lt-lg:not-sr-only', '@container items').block).toBe('@container items (width < 900px) ');
  });

  it('shows the column header row from 900px of card width only', () => {
    expect(ruleOf('it-lg:grid', '@container items').block).toBe('@container items (min-width: 900px) ');
    expect(recipeSource).toContain("'hidden gap-3");
  });

  it('sends the remove button to the top right below 900px and back into its own column from 900px', () => {
    expect(ruleOf('it-md:col-start-6', '@container items').block).toBe('@container items (min-width: 560px) ');
    expect(ruleOf('it-lg:col-auto', '@container items').block).toBe('@container items (min-width: 900px) ');
  });

  it('makes the item controls 44px tall on phones (D-54b)', () => {
    for (const token of ['pg-phone:[&_input]:h-11', 'pg-phone:[&_select]:h-11']) {
      const rule = ruleOf(token);
      expect(rule.block).toBe(PHONE_BLOCK);
      expect(rule.body).toContain('var(--spacing)');
    }
  });

  it('shows the item labels below 900px of card width only', () => {
    expect(recipeSource).toContain('[&_label]:sr-only');
    expect(ruleOf('it-lt-lg:[&_label]:not-sr-only', '@container items').block).toBe('@container items (width < 900px) ');
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

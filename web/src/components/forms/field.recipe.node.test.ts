// @vitest-environment node
// The shared field recipe compiled against the CSPS theme (plan 02-20; D-33, D-01, D-02 FYI-01, PERF-03). Utilities that
// set the same property are resolved by Tailwind's rule order, not by their order in the class string, so these tests
// read the generated CSS and check that the cascade gives the spec result: the region size beats the plain 16px, the
// D-01 phone size beats the region size, the focus look beats hover, and the invalid look beats both. A node test,
// because the class gate reads app.css with node:fs.
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { buildCss, checkClassTokens, collectClassTokens } from '../../../scripts/class-gate.mjs';

const recipeFile = 'src/components/forms/field.recipe.ts';
const recipeSource = readFileSync(new URL('./field.recipe.ts', import.meta.url), 'utf8');
const recipeTokens = collectClassTokens(recipeFile, recipeSource);
const css = await buildCss([...new Set(recipeTokens.map((entry) => entry.token))]);

/** Where the rule for this escaped selector starts in the generated CSS (-1 when absent). */
function ruleAt(selector: string): number {
  return css.indexOf(`${selector} {`);
}

/** The CSS-escaped class selector of a token (`in-data-[ui=s-toolbar]:h-10` → `.in-data-\[ui\=s-toolbar\]\:h-10`). */
function classSelector(token: string): string {
  return `.${token.replace(/[^a-zA-Z0-9_-]/g, (char) => `\\${char}`)}`;
}

/** Asserts that every token's rule exists and that they appear in the given order. */
function expectInOrder(...selectors: string[]): void {
  const positions = selectors.map((selector) => ruleAt(selector));
  for (const [index, position] of positions.entries()) {
    expect(position, selectors[index]).toBeGreaterThanOrEqual(0);
  }
  expect([...positions].sort((a, b) => a - b)).toEqual(positions);
}

/** The text of the `@container pg (max-width: 767px)` block that holds this rule. */
function enclosingPhoneBlock(selector: string): string {
  const position = ruleAt(selector);
  const block = css.lastIndexOf('@container pg (max-width: 767px)', position);
  return block < 0 ? '' : css.slice(block, position);
}

describe('field recipe (App. B forms, App. C toolbar and item rows)', () => {
  it('passes the class gate: every recipe token compiles under the CSPS theme, with no finding', async () => {
    expect(recipeTokens.length).toBeGreaterThan(0);
    expect(await checkClassTokens(recipeTokens, { file: recipeFile })).toEqual([]);
  });

  it('has the D-01 phone rule for toolbar and item-row boxes, and never a placeholder opacity (D-02 FYI-01)', () => {
    const tokens = recipeTokens.map((entry) => entry.token);

    expect(tokens).toContain('pg-phone:in-data-[ui=s-toolbar]:text-[16px]');
    expect(tokens).toContain('pg-phone:in-data-[ui=s-item]:text-[16px]');
    expect(tokens).toContain('placeholder:text-ink-muted');
    expect(tokens.filter((token) => token.startsWith('placeholder:opacity'))).toEqual([]);
    expect(recipeSource).not.toMatch(/maximum-scale|user-scalable/);
  });

  it('emits the region rules as descendants of the data-ui marker with no added specificity', () => {
    expect(css).toContain(`:where([data-ui="s-toolbar"]) ${classSelector('in-data-[ui=s-toolbar]:h-10')} {`);
    expect(css).toContain(`:where([data-ui="s-item"]) ${classSelector('in-data-[ui=s-item]:h-10')} {`);
  });

  it('orders the box text size: 16px, then 14px in a region, then 16px in a region on a phone page (D-01)', () => {
    for (const region of ['s-toolbar', 's-item']) {
      expectInOrder(
        classSelector('text-[16px]'),
        `:where([data-ui="${region}"]) ${classSelector(`in-data-[ui=${region}]:text-[14px]`)}`,
        `:where([data-ui="${region}"]) ${classSelector(`pg-phone:in-data-[ui=${region}]:text-[16px]`)}`,
      );
      expect(
        enclosingPhoneBlock(
          `:where([data-ui="${region}"]) ${classSelector(`pg-phone:in-data-[ui=${region}]:text-[16px]`)}`,
        ),
      ).not.toBe('');
    }
  });

  it('orders the box height: 44px, then 40px in a region', () => {
    expectInOrder(
      classSelector('h-11'),
      `:where([data-ui="s-toolbar"]) ${classSelector('in-data-[ui=s-toolbar]:h-10')}`,
    );
  });

  it('orders the toolbar field width: desktop basis, then the phone and tablet bases inside their page queries', () => {
    expectInOrder(
      `:where([data-ui="s-toolbar"]) ${classSelector('in-data-[ui=s-toolbar]:flex-[0_1_180px]')}`,
      `:where([data-ui="s-toolbar"]) ${classSelector('pg-phone:in-data-[ui=s-toolbar]:flex-[1_1_140px]')}`,
      `:where([data-ui="s-toolbar"]) ${classSelector('pg-tablet:in-data-[ui=s-toolbar]:flex-[1_1_150px]')}`,
    );
  });

  it('orders the control border: hover only while unfocused, so focus wins over it, and invalid after both', () => {
    expectInOrder(
      `${classSelector('focus-within:border-focus')}:focus-within`,
      `${classSelector('hover:not-focus-within:border-ink-muted')}:hover:not(:focus-within)`,
      `${classSelector('has-aria-invalid:border-danger!')}:has([aria-invalid="true"])`,
    );
    // The hover rule is (0,3,0) like the spec's invalid rule, so the invalid border must be important to win.
    expect(css).toMatch(/:has\(\[aria-invalid="true"\]\) \{\s*border-color: var\(--danger\) !important;/);
  });
});

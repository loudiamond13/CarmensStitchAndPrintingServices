// @vitest-environment node
// The lists recipe compiled against the CSPS theme (plan 02-30; D-33, D-02, D-38, UI-SPEC "refetch" and "overflow").
// Utilities that set one property are resolved by Tailwind's rule order, not by their order in the class string, and
// jsdom evaluates no container query, so these tests read the generated CSS: the phone rules sit in the 767px page
// container, the refetch dim beats the phone card surface, the phone hover reset beats the desktop row hover, the
// footer's dashed top beats the border's solid default, and the tablet search row is `!important` like App. C. The
// parity suite proves the compared looks in three engines; these pin what it cannot reach (refetch, tfoot). A node
// test, because the class gate reads app.css with node:fs.
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { buildCss, checkClassTokens, collectClassTokens } from '../../../scripts/class-gate.mjs';

const recipeFile = 'src/components/lists/lists.recipe.ts';
const recipeSource = readFileSync(new URL('./lists.recipe.ts', import.meta.url), 'utf8');
const recipeTokens = collectClassTokens(recipeFile, recipeSource);
const css = await buildCss([...new Set(recipeTokens.map((entry) => entry.token))]);

/** The CSS-escaped class selector of a token (`pg-phone:mb-3` → `.pg-phone\:mb-3`). */
function classSelector(token: string): string {
  return `.${token.replace(/[^a-zA-Z0-9_-]/g, (char) => `\\${char}`)}`;
}

/** Where the first rule whose selector holds exactly this token's class starts (-1 when absent). */
function ruleAt(token: string): number {
  const selector = classSelector(token);
  let from = css.indexOf(selector);
  // A longer class (`bg-surface-2` after `bg-surface`) or an escaped character continues the name.
  while (from >= 0 && /[\w\\-]/.test(css.charAt(from + selector.length))) {
    from = css.indexOf(selector, from + 1);
  }
  return from;
}

function expectInOrder(...tokens: string[]): void {
  const positions = tokens.map((token) => ruleAt(token));
  for (const [index, position] of positions.entries()) {
    expect(position, tokens[index]).toBeGreaterThanOrEqual(0);
  }
  expect([...positions].sort((a, b) => a - b)).toEqual(positions);
}

/** The text of the container block that holds this token's rule. */
function enclosingBlock(token: string): string {
  const position = ruleAt(token);
  const block = css.lastIndexOf('@container pg', position);
  return block < 0 ? '' : css.slice(block, css.indexOf('{', block));
}

describe('lists recipe (App. C toolbar and responsive table)', () => {
  it('passes the class gate: every recipe token compiles under the CSPS theme, with no finding', async () => {
    expect(recipeTokens.length).toBeGreaterThan(0);
    expect(await checkClassTokens(recipeTokens, { file: recipeFile })).toEqual([]);
  });

  it('puts the card rules and the data-label in the phone page container', () => {
    for (const token of ['pg-phone:block', 'pg-phone:before:content-[attr(data-label)]', 'pg-phone:before:hidden']) {
      expect(enclosingBlock(token), token).toBe('@container pg (max-width: 767px) ');
    }
    expect(css).toContain('--tw-content: attr(data-label)');
    expect(enclosingBlock('pg-tablet:min-w-[680px]')).toBe('@container pg (min-width: 768px) and (max-width: 1023px) ');
  });

  it('drops the cell rule on the last row through the row group (D-38) and keeps no opacity anywhere (D-02)', () => {
    expect(css).toContain(`${classSelector('group-last/row:border-b-0')}:is(:where(.group\\/row):last-child *)`);
    expect(recipeTokens.filter((entry) => entry.token.includes('opacity'))).toEqual([]);
  });

  it('dims a refetching phone card over its surface, and resets the row hover on phones', () => {
    expectInOrder('pg-phone:bg-surface', 'pg-phone:in-data-[refetching=true]:bg-surface-2');
    expectInOrder('group-hover/row:bg-surface-2', 'pg-phone:group-hover/row:bg-transparent');
    expect(css).toContain(
      `:where([data-refetching="true"]) ${classSelector('in-data-[refetching=true]:bg-surface-2')}`,
    );
  });

  it('draws the footer rule dashed on top only, and gives the tablet search its own row with !important', () => {
    expectInOrder('border-t-2', '[border-top-style:dashed]');
    expect(css).toMatch(/> :first-child \{\s*flex: 1 1 100% !important;/);
  });

  it('contains the table frame paint from 768px up and none on phones, keeping its App. C tokens (D-41 R2-02)', () => {
    expect(recipeTokensOf('tableWrapClasses')).toEqual(
      [
        'overflow-x-auto',
        'rounded-md',
        'border',
        'border-line',
        'bg-surface',
        'contain-paint',
        'pg-phone:overflow-visible',
        'pg-phone:border-0',
        'pg-phone:bg-transparent',
        'pg-phone:contain-none',
      ].sort(),
    );
    expect(enclosingBlock('pg-phone:contain-none')).toBe('@container pg (max-width: 767px) ');
    expectInOrder('contain-paint', 'pg-phone:contain-none');
  });
});

describe('list SearchBox focus look (D-41 R2-03)', () => {
  it('turns its own 1px border --focus on focus-within, with no outer ring (not the shared field ring)', () => {
    const tokens = recipeTokensOf('searchBoxClasses');

    expect(tokens).toEqual(
      [
        'flex',
        'h-10',
        'items-center',
        'gap-2',
        'rounded-sm',
        'border',
        'border-line-strong',
        'bg-surface-2',
        'px-3',
        'text-ink-muted',
        'focus-within:border-focus',
      ].sort(),
    );
    expect(tokens.filter((token) => /shadow|ring|outline/.test(token))).toEqual([]);
    expect(recipeTokensOf('searchInputClasses')).toContain('[outline:none]');
  });
});

/** The sorted class tokens of one exported `tw('…')` list in lists.recipe.ts. */
function recipeTokensOf(name: string): string[] {
  const match = new RegExp(`export const ${name} = tw\\(\\s*'([^']*)'`).exec(recipeSource);
  return (match?.[1] ?? '').split(/\s+/).filter(Boolean).sort();
}

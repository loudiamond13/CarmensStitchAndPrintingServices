// @vitest-environment node
// The quote requests recipe against the Phase 13 type set (13-UI-SPEC Typography: sizes 16, 14, 13 and weights 400, 600).
// A node test, because the class gate reads app.css with node:fs.
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { buildCss, checkClassTokens, collectClassTokens } from '../../../../scripts/class-gate.mjs';

const recipeFile = 'src/modules/admin/components/quoteRequests.recipe.ts';
const recipeSource = readFileSync(new URL('./quoteRequests.recipe.ts', import.meta.url), 'utf8');
const recipeTokens = collectClassTokens(recipeFile, recipeSource);
const css = await buildCss([...new Set(recipeTokens.map((entry) => entry.token))]);

/** The class list of one `tw('...')` export, read from the recipe source. */
function classesOf(name: string): string {
  const match = new RegExp(String.raw`export const ${name} = tw\(\s*'([^']*)'`).exec(recipeSource);
  expect(match, name).not.toBeNull();
  return match?.[1] ?? '';
}

describe('quote requests recipe', () => {
  it('passes the class gate: every token compiles under the CSPS theme, with no finding', async () => {
    expect(recipeTokens.length).toBeGreaterThan(0);
    expect(await checkClassTokens(recipeTokens, { file: recipeFile })).toEqual([]);
  });

  it('draws the selected pill at 600, inside the declared weights', () => {
    expect(classesOf('quotePillOnClasses')).toBe('border-primary bg-primary font-semibold text-on-primary');
  });

  it('writes the declared sizes (16, 14, 13) with the theme tokens, never a raw px size', () => {
    expect(recipeSource).not.toMatch(/text-\[1[346]px\]/);
    expect(classesOf('quoteReceivedTimeClasses')).toBe('text-14 leading-5 text-ink-muted');
    expect(classesOf('quoteTeamClasses')).toBe('text-14 leading-5 wrap-anywhere text-ink-muted');
    expect(classesOf('quoteTermClasses')).toBe('text-14 leading-5 font-semibold text-ink');
    expect(classesOf('quoteValueClasses')).toBe('m-0 text-16 leading-6 wrap-anywhere text-ink');
    expect(classesOf('quoteMutedClasses')).toBe('m-0 text-14 leading-5 text-ink-muted');
    expect(classesOf('quoteHistoryListClasses')).toBe(
      'm-0 flex list-none flex-col gap-3 p-0 text-14 leading-5 text-ink',
    );
    expect(classesOf('quoteNoteAuthorClasses')).toBe('m-0 text-14 leading-5 font-semibold text-ink');
  });

  it('keeps the rendered sizes: 14px over 20px lines and 16px over 24px lines', () => {
    expect(css).toMatch(/--text-14:\s*14px/);
    expect(css).toMatch(/--text-16:\s*16px/);
    expect(css).toMatch(/\.text-14\s*\{[^}]*font-size:\s*var\(--text-14\)/);
    expect(css).toMatch(/\.text-16\s*\{[^}]*font-size:\s*var\(--text-16\)/);
    expect(css).toMatch(/\.leading-5\s*\{[^}]*line-height:\s*calc\(var\(--spacing\)\s*\*\s*5\)/);
    expect(css).toMatch(/\.leading-6\s*\{[^}]*line-height:\s*calc\(var\(--spacing\)\s*\*\s*6\)/);
  });
});

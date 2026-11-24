// @vitest-environment node
// The quote requests recipe against the Phase 13 type set (13-UI-SPEC Typography: sizes 16, 14, 13 and weights 400, 600).
// A node test, because the class gate reads app.css with node:fs.
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { checkClassTokens, collectClassTokens } from '../../../../scripts/class-gate.mjs';

const recipeFile = 'src/modules/admin/components/quoteRequests.recipe.ts';
const recipeSource = readFileSync(new URL('./quoteRequests.recipe.ts', import.meta.url), 'utf8');
const recipeTokens = collectClassTokens(recipeFile, recipeSource);

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
});

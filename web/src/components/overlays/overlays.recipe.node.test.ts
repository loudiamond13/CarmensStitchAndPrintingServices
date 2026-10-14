// @vitest-environment node
// The Overlay region recipe compiled against the CSPS theme (plan 02-41; owner ruling D-42, UAT G-2-199). App. C
// `.s-overlay` pinned every dialog 140px down (96px on phone pages) with nothing to scroll, so on a short window the
// buttons of a tall dialog were off screen. D-42 keeps the approved position wherever the dialog fits and, when it does
// not, lets a spacer above the dialog shrink (down to the 16px edge gap, 0 on phones) and the backdrop scroll. jsdom
// evaluates no container query and no pseudo-element, so these tests read the generated CSS; the parity suite proves
// the 900px-tall looks and `@dialog-fit` (web/e2e/dialog-fit.spec.ts) proves the short windows in real engines. A node
// test, because the class gate reads app.css with node:fs.
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { buildCss, checkClassTokens, collectClassTokens } from '../../../scripts/class-gate.mjs';
import { overlayRegionClasses } from './overlays.recipe.ts';

/**
 * The D-42 transcription of App. C `.s-overlay`: the fixed scrim region as a column with 16px padding (0 on phone
 * pages), a `::before` spacer of 124px (96px on phone pages) that alone may shrink, children that never shrink, and a
 * backdrop that scrolls as the last resort.
 */
const D42_REGION =
  "fixed inset-0 z-(--z-overlay) flex flex-col items-center justify-start overflow-y-auto bg-scrim p-4 *:shrink-0 before:basis-[124px] before:content-[''] pg-phone:p-0 pg-phone:before:basis-[96px]";

/** The class tokens of a class string, sorted (Prettier may reorder the literal). */
const tokensOf = (classes: string): string[] => classes.split(/\s+/).filter(Boolean).sort();

const recipeFile = 'src/components/overlays/overlays.recipe.ts';
const recipeSource = readFileSync(new URL('./overlays.recipe.ts', import.meta.url), 'utf8');
const recipeTokens = collectClassTokens(recipeFile, recipeSource);
const css = await buildCss(tokensOf(overlayRegionClasses));

/** The utilities layer only (the theme and base layers hold token values such as `--space-24: 96px`). */
const utilities = css.slice(css.indexOf('@layer utilities {'));

/** The phone page container block of the utilities (either spelling of the 767px query), or '' when absent. */
function phoneBlock(): string {
  const start = utilities.search(/@container pg \((?:width <= 767px|max-width: 767px)\) \{/);
  if (start < 0) {
    return '';
  }
  let depth = 0;
  for (let index = utilities.indexOf('{', start); index < utilities.length; index += 1) {
    const char = utilities.charAt(index);
    if (char === '{') {
      depth += 1;
    } else if (char === '}') {
      depth -= 1;
      if (depth === 0) {
        return utilities.slice(start, index + 1);
      }
    }
  }
  return '';
}

/** The utilities outside the phone container. */
const desktop = (): string => utilities.replace(phoneBlock(), '');

/** The declaration blocks of every `::before` rule in a stretch of CSS. */
function beforeRules(text: string): string[] {
  return [...text.matchAll(/::before \{([^}]*)\}/g)].map((match) => match[1] ?? '');
}

describe('Overlay region recipe (App. C .s-overlay, owner ruling D-42)', () => {
  it('is exactly the D-42 transcription', () => {
    expect(tokensOf(overlayRegionClasses)).toEqual(tokensOf(D42_REGION));
  });

  it('passes the class gate: every recipe token compiles under the CSPS theme, with no finding', async () => {
    expect(recipeTokens.length).toBeGreaterThan(0);
    expect(await checkClassTokens(recipeTokens, { file: recipeFile })).toEqual([]);
  });

  it('flows as a column, top first, centred sideways, and scrolls when the dialog is still taller', () => {
    expect(desktop()).toContain('flex-direction: column;');
    expect(desktop()).toContain('justify-content: flex-start;');
    expect(desktop()).toContain('align-items: center;');
    expect(desktop()).toContain('overflow-y: auto;');
  });

  it('never lets the dialog itself shrink: its direct children keep flex-shrink 0', () => {
    expect(desktop()).toMatch(/> \*\)? \{\s*flex-shrink: 0;\s*\}/);
  });

  it('draws a 124px spacer above the dialog (16px padding + 124px = the approved 140px)', () => {
    const rules = beforeRules(desktop());

    expect(
      rules.some((rule) => rule.includes('flex-basis: 124px;') && rule.includes('content: var(--tw-content);')),
    ).toBe(true);
    expect(desktop()).toMatch(/\.p-4 \{\s*padding: calc\(var\(--spacing\) \* 4\);/);
  });

  it('uses a 96px spacer and no padding on phone pages (the approved 96px, down to 0)', () => {
    const phone = phoneBlock();

    expect(phone).not.toBe('');
    expect(beforeRules(phone).some((rule) => rule.includes('flex-basis: 96px;'))).toBe(true);
    expect(phone).toMatch(/padding: 0(?:px)?;/);
  });

  it('has no fixed 140px top gap any more', () => {
    expect(utilities).not.toContain('140px');
  });
});

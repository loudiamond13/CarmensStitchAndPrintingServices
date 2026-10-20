// @vitest-environment node
// hitAreaClasses (OQ-5, plan 04-26): an invisible 44px-tall tap area for a small inline link or label. It is a `::before`
// box, so the element itself keeps its size, colour and position. A node test, because the class gate reads app.css.
import { describe, expect, it } from 'vitest';
import { buildCss } from '../../../scripts/class-gate.mjs';
import { hitAreaClasses, targetAreaClasses } from './button.recipe.ts';

const tokensOf = (classes: string): string[] => classes.split(/\s+/).filter(Boolean).sort();

const SPEC_HIT_AREA =
  "relative before:absolute before:inset-x-0 before:top-1/2 before:h-11 before:-translate-y-1/2 before:content-['']";

describe('hitAreaClasses (OQ-5)', () => {
  it('holds exactly the UI-SPEC transcription', () => {
    expect(tokensOf(hitAreaClasses)).toEqual(tokensOf(SPEC_HIT_AREA));
  });

  it('compiles to a 44px-tall, full-width, vertically centred empty ::before box', async () => {
    const css = (await buildCss(tokensOf(hitAreaClasses))).replace(/\s+/g, ' ');

    expect(css).toContain('position: absolute');
    expect(css).toContain('inset-inline: 0px');
    expect(css).toMatch(/top: calc\(1 \/ 2 \* 100%\)/);
    expect(css).toMatch(/height: calc\(var\(--spacing\) \* 11\)/);
    expect(css).toMatch(/--tw-content: ''/);
    expect(css).toMatch(/--tw-translate-y: calc\(calc\(1 \/ 2 \* 100%\) \* -1\)/);
  });

  it('changes nothing on the element itself except making it the box the area is centred on', async () => {
    const css = await buildCss(tokensOf(hitAreaClasses));
    const utilities = css.slice(
      css.indexOf('@layer utilities'),
      css.indexOf('@layer base', css.indexOf('@layer utilities')),
    );
    const selectors = [...utilities.matchAll(/^\s*(\.[^{]+)\{/gm)].map((match) => (match[1] ?? '').trim());

    const onElement = selectors.filter((selector) => !selector.includes('::before'));
    expect(onElement).toEqual(['.relative']);
    expect(utilities).toMatch(/\.relative\s*\{\s*position: relative;\s*\}/);
  });
});

const TARGET_AREA =
  "relative before:absolute before:top-1/2 before:left-1/2 before:size-11 before:-translate-x-1/2 before:-translate-y-1/2 before:content-['']";

describe('targetAreaClasses (WR-20)', () => {
  it('holds exactly the agreed token list', () => {
    expect(tokensOf(targetAreaClasses)).toEqual(tokensOf(TARGET_AREA));
  });

  it('compiles to an empty 44px square ::before box centred on the element', async () => {
    const css = (await buildCss(tokensOf(targetAreaClasses))).replace(/\s+/g, ' ');

    expect(css).toContain('position: absolute');
    expect(css).toMatch(/top: calc\(1 \/ 2 \* 100%\)/);
    expect(css).toMatch(/left: calc\(1 \/ 2 \* 100%\)/);
    expect(css).toMatch(/width: calc\(var\(--spacing\) \* 11\)/);
    expect(css).toMatch(/height: calc\(var\(--spacing\) \* 11\)/);
    expect(css).toMatch(/--tw-content: ''/);
    expect(css).toMatch(/--tw-translate-x: calc\(calc\(1 \/ 2 \* 100%\) \* -1\)/);
    expect(css).toMatch(/--tw-translate-y: calc\(calc\(1 \/ 2 \* 100%\) \* -1\)/);
  });

  it('changes nothing on the element itself except making it the box the area is centred on', async () => {
    const css = await buildCss(tokensOf(targetAreaClasses));
    const utilities = css.slice(
      css.indexOf('@layer utilities'),
      css.indexOf('@layer base', css.indexOf('@layer utilities')),
    );
    const selectors = [...utilities.matchAll(/^\s*(\.[^{]+)\{/gm)].map((match) => (match[1] ?? '').trim());

    const onElement = selectors.filter((selector) => !selector.includes('::before'));
    expect(onElement).toEqual(['.relative']);
    expect(utilities).toMatch(/\.relative\s*\{\s*position: relative;\s*\}/);
  });
});

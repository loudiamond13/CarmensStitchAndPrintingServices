// @vitest-environment node
// The shared layout looks (D-33, WEB-02; UI-SPEC "Class-name hooks policy" and "Token theme"): the page root
// transcribes App. C `.s-page` and the visually-hidden constant transcribes App. B `.csp-sr`, both as complete class
// literals that the 02-05 class gate compiles to CSS. A node test, because the class gate reads app.css with node:fs.
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { buildCss, checkClassTokens, collectClassTokens } from '../../../scripts/class-gate.mjs';
import {
  pageHeadClasses,
  pageHeadTitleClasses,
  pageRootClasses,
  pageSublineClasses,
  pageTitleClasses,
  srOnlyClasses,
} from './layout.recipe.ts';

// UI-SPEC "Class-name hooks policy": the .csp-sr look, not Tailwind's own visually-hidden utility, so computed
// styles match the reference (`position: absolute; width: 1px; height: 1px; overflow: hidden;
// clip: rect(0 0 0 0); white-space: nowrap`).
const SPEC_SR_ONLY = 'absolute h-px w-px overflow-hidden [clip:rect(0_0_0_0)] whitespace-nowrap';
// App. C `.s-page`: `container: pg / inline-size; position: relative; min-height: 100%; background: var(--bg);
// color: var(--ink); font-family: var(--font-sans); font-size: 16px; line-height: 24px`.
const SPEC_PAGE_ROOT = '@container/pg relative min-h-full bg-bg text-ink font-sans text-[16px] leading-6';

// App. C `.s-ph` (plan 02-31): `display: flex; flex-wrap: wrap; align-items: flex-end; justify-content: space-between;
// gap: var(--space-4)`, and `align-items: flex-start` on phones.
const SPEC_PAGE_HEAD = 'flex flex-wrap items-end justify-between gap-4 pg-phone:items-start';
// `.s-ph-title`: `display: flex; flex-direction: column; gap: 4px; min-width: 0`.
const SPEC_PAGE_HEAD_TITLE = 'flex min-w-0 flex-col gap-1';
// `.s-ph-title h1`: display 700, 34px, line-height 1.05; 30px in the tablet rule and in the phone rule.
const SPEC_PAGE_TITLE = 'font-display font-bold text-[34px] leading-[1.05] pg-phone:text-[30px] pg-tablet:text-[30px]';
// `.s-ph-title p`: 14px / 20px in --ink-muted.
const SPEC_PAGE_SUBLINE = 'text-[14px] leading-5 text-ink-muted';

/** The class tokens of a class string, sorted (Prettier may reorder the literal). */
const tokensOf = (classes: string): string[] => classes.split(/\s+/).filter(Boolean).sort();

const recipeFile = 'src/ui/layout/layout.recipe.ts';
const recipeSource = readFileSync(new URL('./layout.recipe.ts', import.meta.url), 'utf8');

describe('layout recipe (.s-page and .csp-sr looks)', () => {
  it('srOnlyClasses holds exactly the .csp-sr transcription', () => {
    expect(tokensOf(srOnlyClasses)).toEqual(tokensOf(SPEC_SR_ONLY));
  });

  it('pageRootClasses holds exactly the .s-page transcription', () => {
    expect(tokensOf(pageRootClasses)).toEqual(tokensOf(SPEC_PAGE_ROOT));
  });

  it('passes the class gate: every recipe token compiles under the CSPS theme, with no finding', async () => {
    const tokens = collectClassTokens(recipeFile, recipeSource);
    expect(tokens.map((entry) => entry.token).sort()).toEqual(
      tokensOf(
        `${SPEC_SR_ONLY} ${SPEC_PAGE_ROOT} ${SPEC_PAGE_HEAD} ${SPEC_PAGE_HEAD_TITLE} ${SPEC_PAGE_TITLE} ${SPEC_PAGE_SUBLINE}`,
      ),
    );
    expect(await checkClassTokens(tokens, { file: recipeFile })).toEqual([]);
  });

  it('compiles the visually-hidden look to the .csp-sr declarations', async () => {
    const css = await buildCss(tokensOf(srOnlyClasses));
    for (const declaration of [
      'position: absolute',
      'overflow: hidden',
      'clip: rect(0 0 0 0)',
      'white-space: nowrap',
    ]) {
      expect(css).toContain(declaration);
    }
  });

  it('compiles the page root to a named inline-size container with the .s-page type', async () => {
    const css = await buildCss(tokensOf(pageRootClasses));
    for (const declaration of [
      'container-type: inline-size',
      'container-name: pg',
      'position: relative',
      'min-height: 100%',
      'font-size: 16px',
    ]) {
      expect(css).toContain(declaration);
    }
  });

  it('holds exactly the .s-ph, .s-ph-title, h1 and subline transcriptions (plan 02-31)', () => {
    expect(tokensOf(pageHeadClasses)).toEqual(tokensOf(SPEC_PAGE_HEAD));
    expect(tokensOf(pageHeadTitleClasses)).toEqual(tokensOf(SPEC_PAGE_HEAD_TITLE));
    expect(tokensOf(pageTitleClasses)).toEqual(tokensOf(SPEC_PAGE_TITLE));
    expect(tokensOf(pageSublineClasses)).toEqual(tokensOf(SPEC_PAGE_SUBLINE));
  });

  it("sizes the h1 30px under App. C's own phone and tablet queries, so 767.5px and 1023.5px stay 34px (WEB-05)", async () => {
    const css = (await buildCss(tokensOf(pageTitleClasses))).replace(/\s+/g, ' ');
    expect(css).toMatch(/@container pg \(width <= 767px\)|@container pg \(max-width: 767px\)/);
    expect(css).toMatch(
      /@container pg \(width >= 768px\) and \(width <= 1023px\)|@container pg \(min-width: 768px\) and \(max-width: 1023px\)/,
    );
    expect(css).not.toMatch(/@container pg \((?:width <= 1023px|max-width: 1023px)\) \{/);
  });
});

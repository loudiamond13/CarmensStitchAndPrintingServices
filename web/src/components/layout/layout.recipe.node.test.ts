// @vitest-environment node
// The shared layout looks (D-33, WEB-02; UI-SPEC "Class-name hooks policy" and "Token theme"): the page root
// transcribes App. C `.s-page` and the visually-hidden constant transcribes App. B `.csp-sr`, both as complete class
// literals that the 02-05 class gate compiles to CSS. A node test, because the class gate reads app.css with node:fs.
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { buildCss, checkClassTokens, collectClassTokens } from '../../../scripts/class-gate.mjs';
import {
  authPageRootClasses,
  loginBackClasses,
  loginBandsClasses,
  loginBrandClasses,
  loginCardClasses,
  loginClasses,
  loginEyebrowClasses,
  loginFixedClasses,
  loginFormColumnClasses,
  loginLinkClasses,
  loginLogoClasses,
  loginNumeralClasses,
  loginQuoteClasses,
  loginQuoteTextClasses,
  loginRowClasses,
  loginSlabClasses,
  loginTitleClasses,
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

// App. C login looks (`.s-login*`, `.s-eyebrow`, `.s-link`, `.s-back`, `.s-login-row`) and their container rules.
// The page root keeps `.s-page` but is `min-h-dvh` (spec §8.2).
const SPEC_AUTH_PAGE_ROOT = '@container/pg relative min-h-dvh bg-bg text-ink font-sans text-[16px] leading-6';
// `.s-login`: grid 1.1fr 1fr, `minmax(0, 1fr)` in the 1023 container rule.
const SPEC_LOGIN = 'grid min-h-dvh grid-cols-[1.1fr_1fr] bg-bg pg-lt-lg:grid-cols-[minmax(0,1fr)]';
// `.s-login` at the parity preview's fixed height: the same grid with `--login-h` in place of `min-h-dvh`.
const SPEC_LOGIN_FIXED = 'grid min-h-(--login-h) grid-cols-[1.1fr_1fr] bg-bg pg-lt-lg:grid-cols-[minmax(0,1fr)]';
// `.s-login-brand.s-mesh`: relative, clipped, padding 48, column space-between, `--surface`, right hairline; phone rule:
// padding 24/16, min-height 200, no right border, bottom hairline.
const SPEC_LOGIN_BRAND =
  'relative flex flex-col justify-between overflow-hidden border-r border-line bg-surface p-12 bg-[image:radial-gradient(circle_at_1px_1px,color-mix(in_srgb,var(--ink)_9%,transparent)_1px,transparent_1.6px)] bg-size-[6px_6px] pg-phone:min-h-[200px] pg-phone:border-r-0 pg-phone:border-b pg-phone:px-4 pg-phone:py-6';
// `.s-login-slab`: right -10%, bottom -6%, 78% x 62%, accent, clipped; phone 60% x 80%.
const SPEC_LOGIN_SLAB =
  'absolute right-[-10%] bottom-[-6%] h-[62%] w-[78%] bg-accent [clip-path:polygon(0_22%,100%_0,100%_100%,0_100%)] pg-phone:h-[80%] pg-phone:w-[60%]';
// `.s-login-bands`: the same box and clip, `-14deg` stripes in `--on-accent`, masked to the lower 45%.
const SPEC_LOGIN_BANDS =
  'absolute right-[-10%] bottom-[-6%] h-[62%] w-[78%] [clip-path:polygon(0_22%,100%_0,100%_100%,0_100%)] bg-[image:repeating-linear-gradient(-14deg,transparent_0_46px,var(--on-accent)_46px_56px)] [mask-image:linear-gradient(transparent_55%,var(--ink)_56%)] pg-phone:h-[80%] pg-phone:w-[60%]';
// `.s-login-num`: display 800 italic 300px, outlined, 50% opacity; phone: 160px at the right.
const SPEC_LOGIN_NUMERAL =
  'absolute bottom-[18%] left-12 font-display text-[300px] leading-[.8] font-heavy text-transparent italic opacity-50 [-webkit-text-stroke:2px_var(--line-strong)] pg-phone:right-4 pg-phone:bottom-[10%] pg-phone:left-auto pg-phone:text-[160px]';
// `.s-login-quote`: relative, 420 wide, column gap 12; hidden on phones. The quote line is display 800 40px uppercase.
const SPEC_LOGIN_QUOTE = 'relative flex max-w-[420px] flex-col gap-3 pg-phone:hidden';
const SPEC_LOGIN_QUOTE_TEXT = 'font-display text-[40px] leading-none font-heavy uppercase';
// `.s-login-form`: centred, padding 48/24; phone: top-aligned, padding 32/16.
const SPEC_LOGIN_FORM = 'flex items-center justify-center px-6 py-12 pg-phone:items-start pg-phone:px-4 pg-phone:py-8';
// `.s-login-card`: full width up to 420, column gap 20. `.s-login-card h1`: display 800 44px, 36px on phones.
const SPEC_LOGIN_CARD = 'flex w-full max-w-[420px] flex-col gap-5';
const SPEC_LOGIN_TITLE =
  'font-display text-[44px] leading-none font-heavy uppercase focus:[outline:none] pg-phone:text-[36px]';
// `.s-eyebrow`, `.s-login-row`, `.s-link.s-small`, `.s-back`.
const SPEC_EYEBROW =
  'inline-flex items-center gap-2 font-display text-[14px] leading-[1.15] font-bold tracking-[.16em] text-accent-ink uppercase before:h-[3px] before:w-[24px] before:[transform:skewX(-18deg)] before:bg-accent-line';
const SPEC_LOGIN_ROW = 'flex items-center justify-between gap-3';
const SPEC_LOGIN_LINK =
  'inline-flex items-center gap-1.5 text-[14px] leading-5 font-button text-accent-ink! no-underline hover:underline hover:underline-offset-4';
const SPEC_LOGIN_BACK =
  'inline-flex items-center gap-1 text-[13px] font-semibold text-ink-muted! no-underline hover:text-ink!';
// `.s-login-brand` logo wrapper: `position: relative`.
const SPEC_LOGIN_LOGO = 'relative';

const LOGIN_SPECS = [
  SPEC_AUTH_PAGE_ROOT,
  SPEC_LOGIN,
  SPEC_LOGIN_FIXED,
  SPEC_LOGIN_BRAND,
  SPEC_LOGIN_SLAB,
  SPEC_LOGIN_BANDS,
  SPEC_LOGIN_NUMERAL,
  SPEC_LOGIN_QUOTE,
  SPEC_LOGIN_QUOTE_TEXT,
  SPEC_LOGIN_FORM,
  SPEC_LOGIN_CARD,
  SPEC_LOGIN_TITLE,
  SPEC_EYEBROW,
  SPEC_LOGIN_ROW,
  SPEC_LOGIN_LINK,
  SPEC_LOGIN_BACK,
  SPEC_LOGIN_LOGO,
].join(' ');

/** The class tokens of a class string, sorted (Prettier may reorder the literal). */
const tokensOf = (classes: string): string[] => classes.split(/\s+/).filter(Boolean).sort();

const recipeFile = 'src/components/layout/layout.recipe.ts';
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
        `${SPEC_SR_ONLY} ${SPEC_PAGE_ROOT} ${SPEC_PAGE_HEAD} ${SPEC_PAGE_HEAD_TITLE} ${SPEC_PAGE_TITLE} ${SPEC_PAGE_SUBLINE} ${LOGIN_SPECS}`,
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

describe('login recipes (App. C `.s-login*`, plan 04-26)', () => {
  it.each([
    ['authPageRootClasses', authPageRootClasses, SPEC_AUTH_PAGE_ROOT],
    ['loginClasses', loginClasses, SPEC_LOGIN],
    ['loginFixedClasses', loginFixedClasses, SPEC_LOGIN_FIXED],
    ['loginBrandClasses', loginBrandClasses, SPEC_LOGIN_BRAND],
    ['loginSlabClasses', loginSlabClasses, SPEC_LOGIN_SLAB],
    ['loginBandsClasses', loginBandsClasses, SPEC_LOGIN_BANDS],
    ['loginNumeralClasses', loginNumeralClasses, SPEC_LOGIN_NUMERAL],
    ['loginQuoteClasses', loginQuoteClasses, SPEC_LOGIN_QUOTE],
    ['loginQuoteTextClasses', loginQuoteTextClasses, SPEC_LOGIN_QUOTE_TEXT],
    ['loginFormColumnClasses', loginFormColumnClasses, SPEC_LOGIN_FORM],
    ['loginCardClasses', loginCardClasses, SPEC_LOGIN_CARD],
    ['loginTitleClasses', loginTitleClasses, SPEC_LOGIN_TITLE],
    ['loginEyebrowClasses', loginEyebrowClasses, SPEC_EYEBROW],
    ['loginRowClasses', loginRowClasses, SPEC_LOGIN_ROW],
    ['loginLinkClasses', loginLinkClasses, SPEC_LOGIN_LINK],
    ['loginBackClasses', loginBackClasses, SPEC_LOGIN_BACK],
    ['loginLogoClasses', loginLogoClasses, SPEC_LOGIN_LOGO],
  ])('%s holds exactly its App. C transcription', (_name, actual, expected) => {
    expect(tokensOf(actual)).toEqual(tokensOf(expected));
  });

  it('the grid is 1.1fr 1fr, one column at the 1023 container step', async () => {
    const css = (await buildCss(tokensOf(loginClasses))).replace(/\s+/g, ' ');
    expect(css).toContain('grid-template-columns: 1.1fr 1fr');
    expect(css).toMatch(/@container pg \((?:width <= 1023px|max-width: 1023px)\)/);
    expect(css).toMatch(/grid-template-columns: minmax\(0, ?1fr\)/);
  });

  it('the phone brand panel is 200px tall at least, the card 420px wide with a 20px gap, the h1 44px then 36px', async () => {
    const brand = (await buildCss(tokensOf(loginBrandClasses))).replace(/\s+/g, ' ');
    expect(brand).toMatch(/@container pg \((?:width <= 767px|max-width: 767px)\)/);
    expect(brand).toContain('min-height: 200px');
    const card = (await buildCss(tokensOf(loginCardClasses))).replace(/\s+/g, ' ');
    expect(card).toContain('max-width: 420px');
    expect(card).toMatch(/gap: calc\(var\(--spacing\) \* 5\)|gap: 20px/);
    const title = (await buildCss(tokensOf(loginTitleClasses))).replace(/\s+/g, ' ');
    expect(title).toContain('font-size: 44px');
    expect(title).toContain('font-size: 36px');
  });
});

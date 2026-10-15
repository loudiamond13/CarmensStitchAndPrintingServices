// Shared layout looks (D-33, WEB-02). Complete class literals only; the class gate compiles every string here.
import { tw } from '@/ui/tw';

/**
 * Visually hidden text: the App. B `.csp-sr` look (`position: absolute; width: 1px; height: 1px; overflow: hidden;
 * clip: rect(0 0 0 0); white-space: nowrap`). Used instead of Tailwind's own visually-hidden utility, which sets more
 * properties, so computed styles match the reference (UI-SPEC "Class-name hooks policy").
 */
export const srOnlyClasses = tw('absolute h-px w-px overflow-hidden whitespace-nowrap [clip:rect(0_0_0_0)]');

/**
 * The page root: the App. C `.s-page` look (`container: pg / inline-size; position: relative; min-height: 100%;
 * background: var(--bg); color: var(--ink); font-family: var(--font-sans); font-size: 16px; line-height: 24px`).
 * The `pg-*` variants need this container as an ancestor.
 */
export const pageRootClasses = tw('@container/pg relative min-h-full bg-bg font-sans text-[16px] leading-6 text-ink');

// ── Page header (App. C `.s-ph`, spec §8.1; plan 02-31) ──
// The tablet and phone sizes are App. C's two container rules, kept as two variants with the same query text: between
// 767 and 768 px (and 1023 and 1024 px) neither rule applies in the approved CSS, so neither may apply here (WEB-05).

/** `.s-ph`: the title block and the actions in one wrapping row, aligned to the bottom (to the top on phones). */
export const pageHeadClasses = tw('flex flex-wrap items-end justify-between gap-4 pg-phone:items-start');

/** `.s-ph-title`: the h1 over its subline. */
export const pageHeadTitleClasses = tw('flex min-w-0 flex-col gap-1');

/** `.s-ph-title h1`: display 700 at 34px, 30px on tablets and phones. */
export const pageTitleClasses = tw(
  'font-display text-[34px] leading-[1.05] font-bold pg-phone:text-[30px] pg-tablet:text-[30px]',
);

/** `.s-ph-title p`: the 14px muted subline. */
export const pageSublineClasses = tw('text-[14px] leading-5 text-ink-muted');

// ── Auth screens (App. C `.s-login*` and its `@container pg` rules, App. E.5, spec §8.2; plan 04-26) ──
// The page is the `.s-page` look but `min-h-dvh` (spec §8.2). The `pg-lt-lg` variant is App. C's 1023px rule and
// `pg-phone` its 767px rule. The numeral's 50% opacity is the D-02 "login numeral" exception (class-gate.config.mjs).

/** The auth page root: `.s-page` with the full dynamic viewport height. */
export const authPageRootClasses = tw(
  '@container/pg relative min-h-dvh bg-bg font-sans text-[16px] leading-6 text-ink',
);

/** `.s-login`: the brand panel and the form column, 1.1fr to 1fr; one column up to 1023px. */
export const loginClasses = tw('grid min-h-dvh grid-cols-[1.1fr_1fr] bg-bg pg-lt-lg:grid-cols-[minmax(0,1fr)]');

/** `.s-login` at a fixed height (the parity preview, whose frame is the mockup's 960px): `--login-h` replaces `min-h-dvh`. */
export const loginFixedClasses = tw(
  'grid min-h-(--login-h) grid-cols-[1.1fr_1fr] bg-bg pg-lt-lg:grid-cols-[minmax(0,1fr)]',
);

/** `.s-login-brand.s-mesh`: the surface panel with the dot mesh; on phones a 200px band with a bottom hairline. */
export const loginBrandClasses = tw(
  'relative flex flex-col justify-between overflow-hidden border-r border-line bg-surface bg-[image:radial-gradient(circle_at_1px_1px,color-mix(in_srgb,var(--ink)_9%,transparent)_1px,transparent_1.6px)] bg-size-[6px_6px] p-12 pg-phone:min-h-[200px] pg-phone:border-r-0 pg-phone:border-b pg-phone:px-4 pg-phone:py-6',
);

/** `.s-login-slab`: the orange slab, clipped; 60% by 80% on phones. */
export const loginSlabClasses = tw(
  'absolute right-[-10%] bottom-[-6%] h-[62%] w-[78%] bg-accent [clip-path:polygon(0_22%,100%_0,100%_100%,0_100%)] pg-phone:h-[80%] pg-phone:w-[60%]',
);

/** `.s-login-bands`: the stripes over the slab, masked to its lower part. */
export const loginBandsClasses = tw(
  'absolute right-[-10%] bottom-[-6%] h-[62%] w-[78%] bg-[image:repeating-linear-gradient(-14deg,transparent_0_46px,var(--on-accent)_46px_56px)] [mask-image:linear-gradient(transparent_55%,var(--ink)_56%)] [clip-path:polygon(0_22%,100%_0,100%_100%,0_100%)] pg-phone:h-[80%] pg-phone:w-[60%]',
);

/** `.s-login-num`: the outlined "C", decorative; 160px at the right on phones. */
export const loginNumeralClasses = tw(
  'absolute bottom-[18%] left-12 font-display text-[300px] leading-[.8] font-heavy text-transparent italic opacity-50 [-webkit-text-stroke:2px_var(--line-strong)] pg-phone:right-4 pg-phone:bottom-[10%] pg-phone:left-auto pg-phone:text-[160px]',
);

/** The `position: relative` wrapper that lifts the logo above the slab. */
export const loginLogoClasses = tw('relative');

/** `.s-login-quote`: the eyebrow over the quote; hidden on phones. */
export const loginQuoteClasses = tw('relative flex max-w-[420px] flex-col gap-3 pg-phone:hidden');

/** App. E.5's quote line: display 800, 40px, uppercase. */
export const loginQuoteTextClasses = tw('font-display text-[40px] leading-none font-heavy uppercase');

/** `.s-login-form`: centres the card; top-aligned on phones. */
export const loginFormColumnClasses = tw(
  'flex items-center justify-center px-6 py-12 pg-phone:items-start pg-phone:px-4 pg-phone:py-8',
);

/** `.s-login-card`: a column of blocks, 20px apart, up to 420px wide. */
export const loginCardClasses = tw('flex w-full max-w-[420px] flex-col gap-5');

/** `.s-login-card h1`: display 800, 44px (36px on phones). Script focus draws no outline, as `main` does. */
export const loginTitleClasses = tw(
  'font-display text-[44px] leading-none font-heavy uppercase focus:[outline:none] pg-phone:text-[36px]',
);

/** `.s-eyebrow`: the display label with the skewed dash before it. */
export const loginEyebrowClasses = tw(
  'inline-flex items-center gap-2 font-display text-[14px] leading-[1.15] font-bold tracking-[.16em] text-accent-ink uppercase before:h-[3px] before:w-[24px] before:[transform:skewX(-18deg)] before:bg-accent-line',
);

/** `.s-login-row`: the checkbox and the forgot-password link on one row. */
export const loginRowClasses = tw('flex items-center justify-between gap-3');

/** `.s-link.s-small`: the accent link at 14px. */
export const loginLinkClasses = tw(
  'inline-flex items-center gap-1.5 text-[14px] leading-5 font-button text-accent-ink! no-underline hover:underline hover:underline-offset-4',
);

/** `.s-back`: the small muted back link with its chevron. */
export const loginBackClasses = tw(
  'inline-flex items-center gap-1 text-[13px] font-semibold text-ink-muted! no-underline hover:text-ink!',
);

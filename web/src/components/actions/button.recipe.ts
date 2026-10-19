// The button look: App. B `.csp-btn*` transcribed to utilities (D-33). Shared by Button, ButtonLink and SkipLink (UI-SPEC
// "Where class strings live"). Every string here is a complete class literal inside tw('…') (the class gate compiles
// each one); the axes set disjoint properties:
//   base     display, alignment, gap, line height, weight, tracking, radius, border width/style, cursor, white space,
//            decoration, transition, the press nudge, and the disabled / pending (WEB-09) look;
//   variant  background, text colour, border colour and the hover state;
//   size     height and font size; padding (labelled) or width (icon-only) come from two separate maps, so the one
//            overlap App. B resolves by source order (.csp-btn-icon resets the size padding) never reaches the DOM;
//   block    width.
// App. B's font shorthand reset (`font: inherit`) is dropped on purpose: preflight already gives buttons that reset,
// and an arbitrary font-shorthand utility would override the size's font-size after it (research Pitfall 24). Hover and
// press are guarded with `not-disabled:not-aria-disabled:`, so a disabled or pending button keeps its resting look
// (App. B `:not(:disabled)` plus the WEB-09 ruling); unlike the `:enabled` variant, `not-disabled:` also matches links
// (research Pitfall 27).
import clsx from 'clsx';
import { tw } from '@/ui/tw';

export type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'danger' | 'ghost-danger';
export type ButtonSize = 'sm' | 'md' | 'lg';

/**
 * `.csp-btn`, `.csp-btn:active:not(:disabled)` and `.csp-btn:disabled`, plus the WEB-09 pending look
 * (`[aria-disabled="true"]` looks exactly like `:disabled`).
 */
const base = tw(
  'inline-flex cursor-pointer items-center justify-center gap-2 rounded-sm border leading-5 font-button tracking-[.01em] whitespace-nowrap no-underline transition-[background-color,border-color,color,transform,box-shadow] duration-150 ease-[ease] active:not-disabled:not-aria-disabled:[transform:translateY(1px)] disabled:cursor-not-allowed disabled:opacity-45 aria-disabled:cursor-not-allowed aria-disabled:opacity-45',
);

/** `.csp-btn-<variant>` and `.csp-btn-<variant>:hover:not(:disabled)`. */
const variants = {
  primary: tw(
    'border-primary bg-primary text-on-primary hover:not-disabled:not-aria-disabled:border-primary-hover hover:not-disabled:not-aria-disabled:bg-primary-hover hover:not-disabled:not-aria-disabled:[box-shadow:0_6px_20px_-10px_var(--primary)]',
  ),
  secondary: tw(
    'border-line-strong bg-transparent text-ink hover:not-disabled:not-aria-disabled:border-ink-muted hover:not-disabled:not-aria-disabled:bg-surface-2',
  ),
  ghost: tw(
    'border-transparent bg-transparent text-ink-muted hover:not-disabled:not-aria-disabled:bg-surface-2 hover:not-disabled:not-aria-disabled:text-ink',
  ),
  danger: tw('border-danger bg-danger text-on-danger hover:not-disabled:not-aria-disabled:[filter:brightness(1.08)]'),
  'ghost-danger': tw(
    'border-transparent bg-transparent text-ink-muted hover:not-disabled:not-aria-disabled:bg-danger-soft hover:not-disabled:not-aria-disabled:text-danger',
  ),
} as const satisfies Record<ButtonVariant, string>;

/** `.csp-btn` (md) and `.csp-btn-sm` / `.csp-btn-lg`: height and font size. */
const sizes = {
  sm: tw('h-9 text-[14px]'),
  md: tw('h-11 text-[15px]'),
  lg: tw('h-13 text-[16px]'),
} as const satisfies Record<ButtonSize, string>;

/** The inline padding of a labelled button (`padding: 0 var(--space-3 | 5 | 6)`). */
const labelledPadding = {
  sm: tw('px-3'),
  md: tw('px-5'),
  lg: tw('px-6'),
} as const satisfies Record<ButtonSize, string>;

/**
 * `.csp-btn-icon` (width 44px, padding 0) and `.csp-btn-icon.csp-btn-sm` (width 36px). App. B has no lg rule, so an
 * icon-only lg button is 44px wide. Padding 0 is preflight's, because no padding utility is applied.
 */
const iconOnlyWidth = {
  sm: tw('w-9'),
  md: tw('w-11'),
  lg: tw('w-11'),
} as const satisfies Record<ButtonSize, string>;

/** `.csp-btn-block`. `.csp-btn-icon` comes later in App. B, so an icon-only button keeps its own width. */
const block = tw('w-full');

/** Icon size in px by button size, as App. D.3 (Button and ButtonLink): 16 on sm, 18 otherwise. */
export const buttonIconSize = { sm: 16, md: 18, lg: 18 } as const satisfies Record<ButtonSize, number>;

/** `.csp-spin` on the pending spinner, with App. B's reduced-motion `animation-duration: 2.4s`. */
export const buttonSpinnerClasses = tw('animate-csp-spin motion-reduce:[animation-duration:2.4s]');

export interface ButtonClassOptions {
  readonly variant: ButtonVariant;
  readonly size: ButtonSize;
  readonly block?: boolean | undefined;
  readonly iconOnly?: boolean | undefined;
  /** Layout glue only (margin, placement, width); never a restyle (spec rule 3). */
  readonly className?: string | undefined;
}

/** The class list of a button-looking element: Button, ButtonLink and SkipLink. */
export function buttonClasses(options: ButtonClassOptions): string {
  const iconOnly = options.iconOnly === true;
  return clsx(
    base,
    variants[options.variant],
    sizes[options.size],
    iconOnly ? iconOnlyWidth[options.size] : labelledPadding[options.size],
    options.block === true && !iconOnly && block,
    options.className,
  );
}

// SPEC-DEVIATION: OQ-5 small inline links and labels (Forgot password?, the Keep me signed in label, the back link) are 18
// to 20px tall in App. C. This adds an invisible `::before` box fixed at 44px tall, centred on the element and as wide
// as it, so the tap target reaches 44px and nothing drawn changes. The element keeps its size, colour and place.
/** An invisible 44px-tall tap area for a small inline link or label. */
export const hitAreaClasses = tw(
  "relative before:absolute before:inset-x-0 before:top-1/2 before:h-11 before:-translate-y-1/2 before:content-['']",
);

// SPEC-DEVIATION: WR-20 (D-31 O-8 keeps the drawn size of the small icon controls). This adds an invisible 44px square
// `::before` tap area centred on the control, so a tap anywhere in it counts and nothing drawn changes.
/** An invisible 44px square tap area centred on a small icon control. */
export const targetAreaClasses = tw(
  "relative before:absolute before:top-1/2 before:left-1/2 before:size-11 before:-translate-x-1/2 before:-translate-y-1/2 before:content-['']",
);

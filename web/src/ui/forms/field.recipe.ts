// The form-control looks (App. B `/* ── Forms ── */`, App. C `.s-toolbar` and `.s-item` control rules, CSPS-UI-SPEC.md
// §6.3) as complete Tailwind tokens (D-33). Field, PasswordField and Select share them, and so will MoneyInput and
// OtpInput. Every string in this file is a class list (the class gate reads them all).
//
// - The region looks (`.s-toolbar .csp-…`, `.s-item .csp-input`) come from the `data-ui` marker on the region through
//   `in-data-[ui=…]:` (rule 21b): any depth, no added specificity, like the spec's descendant selector.
// - D-01: on phone pages (≤ 767px) the toolbar and item-row boxes take 16px text, so iOS Safari does not zoom on focus;
//   desktop and tablet keep the designed 14px, and the plain box is 16px everywhere. The page never limits zoom.
// - D-02 FYI-01: the placeholder is --ink-muted at full opacity (the spec's `opacity: .8` is not transcribed).
// - The invalid look keys off the box's own `aria-invalid` (`has-aria-invalid:` on the control box), which Field sets
//   exactly when App. D.3 set `.is-invalid`.
// - Axes set disjoint properties (start padding, end padding, height), so no utility fights another for one property.
import clsx from 'clsx';
import type { StrengthScore } from '@/lib/csps';
import { tw } from '@/ui/tw';

/** `.csp-field`, and `.s-toolbar .csp-field` (flex 0 1 180px; phones 1 1 140px; tablets 1 1 150px). */
export const fieldClasses = tw(
  'flex min-w-0 flex-col gap-1.5 in-data-[ui=s-toolbar]:flex-[0_1_180px] pg-phone:in-data-[ui=s-toolbar]:flex-[1_1_140px] pg-tablet:in-data-[ui=s-toolbar]:flex-[1_1_150px]',
);

/** `.csp-label` (14/20, 600, --ink), and `.s-toolbar .csp-label` (12/16, --ink-muted). */
export const labelClasses = tw(
  'text-[14px] leading-5 font-semibold text-ink in-data-[ui=s-toolbar]:text-[12px] in-data-[ui=s-toolbar]:leading-4 in-data-[ui=s-toolbar]:text-ink-muted',
);

/** `.csp-req`: the " *" after a required field's label. */
export const requiredClasses = tw('text-danger');

/**
 * `.csp-control`, its `:hover` and `:focus-within` ring, and `.csp-field.is-invalid .csp-control` (border, and the ring in
 * --danger). As in the spec cascade, the focus look beats hover (hover applies only while the box is not focused) and
 * the invalid look beats both. The spec's invalid rule wins by specificity (0,3,0); `:hover:not(:focus-within)` is
 * already (0,3,0) here, so the invalid border carries `!` (a real cascade fight, research row 30).
 */
export const fieldControlClasses = tw(
  'relative flex items-center rounded-sm border border-line-strong bg-surface-2 transition-[border-color,box-shadow] duration-150 ease-[ease] focus-within:border-focus focus-within:[box-shadow:0_0_0_1px_var(--focus)] hover:not-focus-within:border-ink-muted has-aria-invalid:border-danger! has-aria-invalid:focus-within:[box-shadow:0_0_0_1px_var(--danger)]',
);

/**
 * `.csp-input` without its padding and height (the axes below): 16px text, --ink, the placeholder at full opacity
 * (D-02 FYI-01), and 14px in a toolbar or an item row, 16px there again on phone pages (D-01).
 */
const inputBase = tw(
  'w-full min-w-0 flex-1 border-0 bg-transparent text-[16px] text-ink [outline:none] placeholder:text-ink-muted in-data-[ui=s-item]:text-[14px] in-data-[ui=s-toolbar]:text-[14px] pg-phone:in-data-[ui=s-item]:text-[16px] pg-phone:in-data-[ui=s-toolbar]:text-[16px]',
);

/**
 * One-line boxes are 44px (40px in a toolbar or an item row). `.csp-control.is-multiline .csp-input` (height auto,
 * min 112px, 12px padding, vertical resize, 24px lines) has the higher specificity in the spec, so a multiline box keeps
 * its auto height inside a region too.
 */
const inputHeight = {
  line: tw('h-11 in-data-[ui=s-item]:h-10 in-data-[ui=s-toolbar]:h-10'),
  multiline: tw('h-auto min-h-[112px] resize-y py-3 leading-6'),
} as const;

/** Start padding: `.csp-input` 12px, or `.has-prefix .csp-input` 8px with tabular figures. */
const inputStart = {
  plain: tw('pl-3'),
  prefix: tw('pl-2 tabular-nums'),
} as const;

/** End padding: `.csp-input` 12px; `.has-suffix .csp-input` 48px; `.csp-select select` 40px, no native arrow. */
const inputEnd = {
  plain: tw('pr-3'),
  suffix: tw('pr-12'),
  select: tw('cursor-pointer appearance-none pr-10'),
} as const;

export interface FieldInputOptions {
  /** A textarea (`.is-multiline`). */
  multiline?: boolean | undefined;
  /** A prefix sits before the box (`.has-prefix`). */
  prefix?: boolean | undefined;
  /** A suffix button sits at the end of the box (`.has-suffix`). */
  suffix?: boolean | undefined;
  /** The box is a select, with the chevron at its end (`.csp-select select`). */
  select?: boolean | undefined;
}

/** The text box (`input`, `textarea` or `select`) inside the control box. */
export function fieldInputClasses({
  multiline = false,
  prefix = false,
  suffix = false,
  select = false,
}: FieldInputOptions = {}): string {
  let end: string = inputEnd.plain;
  if (select) {
    end = inputEnd.select;
  } else if (suffix) {
    end = inputEnd.suffix;
  }
  return clsx(
    inputBase,
    multiline ? inputHeight.multiline : inputHeight.line,
    prefix ? inputStart.prefix : inputStart.plain,
    end,
  );
}

/** `.csp-prefix`: the ₱ or % before the box. */
export const prefixClasses = tw('pl-3 font-semibold text-ink-muted');

/** `.csp-suffix-btn`: the 36px button at the end of the box (the password reveal toggle). */
export const suffixButtonClasses = tw(
  'absolute right-1 grid size-9 cursor-pointer place-items-center rounded-[6px] border-0 bg-transparent text-ink-muted hover:bg-surface-3 hover:text-ink',
);

/** `.csp-select-chev`: the chevron over the select's end. */
export const selectChevronClasses = tw('pointer-events-none absolute right-3 text-ink-muted');

/** `.csp-select select option`. */
export const selectOptionClasses = tw('bg-surface-3 text-ink');

const messageBase = tw('m-0 flex items-center gap-1.5 text-[12px] leading-4');
const messageTone = {
  hint: tw('text-ink-muted'),
  error: tw('font-medium text-danger'),
} as const;

/** `.csp-msg` (the hint, --ink-muted) or `.csp-msg.csp-msg-error` (--danger, 500). */
export function messageClasses({ error }: { error: boolean }): string {
  return clsx(messageBase, error ? messageTone.error : messageTone.hint);
}

/** `.csp-strength`: the meter row. */
export const strengthClasses = tw('flex items-center gap-3');

/** `.csp-strength-bars`: four equal tracks, at most 180px. */
export const strengthBarsClasses = tw('grid max-w-[180px] flex-1 grid-cols-[repeat(4,1fr)] gap-1');

const strengthBarBase = tw('h-1 rounded-[2px]');
/** `.csp-strength-bars span` (--line), and `.csp-strength.is-N .on` in the score's tone. */
const strengthBarTone = {
  0: tw('bg-line'),
  1: tw('bg-danger'),
  2: tw('bg-warning'),
  3: tw('bg-info'),
  4: tw('bg-success'),
} as const satisfies Record<StrengthScore, string>;

/** One meter bar: lit bars take the score's tone, the rest stay --line. */
export function strengthBarClasses(score: StrengthScore, on: boolean): string {
  return clsx(strengthBarBase, strengthBarTone[on ? score : 0]);
}

const strengthLabelBase = tw('text-[12px] leading-4 font-semibold');
/** `.csp-strength-label` (--ink-muted), and `.csp-strength.is-N .csp-strength-label` in the score's tone. */
const strengthLabelTone = {
  0: tw('text-ink-muted'),
  1: tw('text-danger'),
  2: tw('text-warning'),
  3: tw('text-info'),
  4: tw('text-success'),
} as const satisfies Record<StrengthScore, string>;

/** The meter label ("Weak" … "Strong", or the empty hint) in the score's tone. */
export function strengthLabelClasses(score: StrengthScore): string {
  return clsx(strengthLabelBase, strengthLabelTone[score]);
}

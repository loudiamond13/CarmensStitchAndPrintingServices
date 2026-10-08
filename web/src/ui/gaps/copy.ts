// SPEC-GAP copy (02-UI-SPEC "Copywriting Contract"): the plain-English strings of the primitives the spec does not
// draw, in one module so the owner can change them in one place and no JSX carries its own wording. Plan 13 adds the
// data-primitive strings (Pagination, FilterBar, loading and error states).

/** MoneyInput (ORD-09, SPEC-GAP). */
export const MONEY_INPUT_COPY = {
  prefix: '₱',
  required: 'Enter an amount.',
  invalid: 'Enter an amount like 1250.50 (numbers only, up to 2 decimals).',
} as const;

/** OtpInput (WEB-06, SPEC-GAP). A showcase example: Phase 4 owns the final sign-in copy. */
export const OTP_INPUT_COPY = {
  legend: 'Sign-in code',
  hint: 'Enter the 6-digit code we emailed you.',
  incomplete: 'Enter all 6 digits.',
  digit: (index: number, count: number): string => `Digit ${String(index)} of ${String(count)}`,
} as const;

/** SkipLink (A11Y-02, SPEC-GAP). */
export const SKIP_LINK_COPY = {
  label: 'Skip to main content',
} as const;

// Checkbox (SPEC-GAP) has no copy of its own: the caller passes the label text (for example the spec's
// "Keep me signed in", App. E), so there is nothing to keep here.

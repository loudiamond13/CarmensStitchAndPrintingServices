// SPEC-GAP copy (02-UI-SPEC "Copywriting Contract"): the plain-English strings of the primitives the spec does not
// draw, in one module so the owner can change them in one place and no JSX carries its own wording. Plan 13 adds the
// data-primitive strings (Pagination, FilterBar, loading and error states).

/** MoneyInput (ORD-09, SPEC-GAP). */
export const MONEY_INPUT_COPY = {
  prefix: '₱',
  required: 'Enter an amount.',
  invalid: 'Enter an amount like 1250.50 (numbers only, up to 2 decimals).',
} as const;

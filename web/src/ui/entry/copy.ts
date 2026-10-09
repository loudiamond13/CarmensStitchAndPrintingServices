// SPEC-GAP: entry copy (UI-SPEC "Copywriting Contract": MoneyInput errors, OtpInput, Skip link). The plain-English
// strings of the entry primitives the spec does not draw, in one module, so the owner can change them in one place and
// no JSX carries its own wording. Checkbox has no copy of its own: the caller passes the label text.

/** The copy of the entry primitives (plan 02-27). */
export const ENTRY_COPY = {
  /** MoneyInput (ORD-09). */
  money: {
    prefix: '₱',
    required: 'Enter an amount.',
    invalid: 'Enter an amount like 1250.50 (numbers only, up to 2 decimals).',
  },
} as const;

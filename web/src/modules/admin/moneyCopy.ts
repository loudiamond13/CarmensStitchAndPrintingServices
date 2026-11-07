// The words of the money screens (UI-SPEC Copywriting Contract, D1 strip and M1; plan 10-13): one module, no wording in JSX.
// No long dash (OR-4).

export const MONEY_COPY = {
  /** The personal strip under the dashboard greeting (D-46). */
  strip: {
    label: 'Your money on hand',
    /** The noun of the loading region: "Loading your money on hand…". */
    things: 'your money on hand',
    /** The figure slot when the read failed (UI-SPEC D1 MoneyStrip, Error). */
    failed: "Couldn't load your money on hand.",
    retry: 'Try Again',
    viewLedger: 'View Ledger',
  },
  /** My Money, /admin/money (D-39). The document title is "{title} · CSPS Admin". */
  page: {
    title: 'My Money',
    // SPEC-GAP: D-39 the subline of the My Money header.
    subline: 'What you hold from payments, transfers and expenses.',
  },
  /** The balance card of My Money (UI-SPEC M1 MoneyOnHandCard). */
  card: {
    overline: 'Money on hand',
    // SPEC-GAP: D-39 the line that says what the figure is made of.
    explanation: 'Payments received and transfers in, minus transfers out, expenses paid and refunds handed back.',
    /** The noun of the loading region: "Loading money on hand…". */
    loadingThings: 'money on hand',
    /** The noun of the failure line: "Couldn't load the money on hand.". */
    failedThings: 'the money on hand',
  },
} as const;

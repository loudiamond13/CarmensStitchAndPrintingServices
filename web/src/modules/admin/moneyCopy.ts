// The words of the money screens (UI-SPEC Copywriting Contract, D1 strip and M1; plan 10-13): one module, no wording in JSX.
// No long dash (OR-4).
import { EXPENSES_COPY } from '@/modules/admin/expensesCopy';

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
  /** The Transfer Money window (UI-SPEC T1, D-47) and the button that opens it (D-46, D-39). */
  transfer: {
    /** The button on the strip and on My Money. */
    button: 'Transfer',
    // SPEC-GAP: D-14 the visible reason beside a Transfer button that cannot be used.
    nothingOnHand: 'Nothing on hand to transfer.',
    // SPEC-GAP: T1 the window's words.
    title: 'Transfer Money',
    /** "From Carmen Reyes (you). You have ₱8,450.00 on hand." */
    description: (name: string, balance: string): string => `From ${name} (you). You have ${balance} on hand.`,
    to: {
      label: 'To',
      placeholder: 'Choose a coworker',
      hint: 'Who got the cash.',
      /** The same words as the Paid by picker (P6). */
      loading: EXPENSES_COPY.form.paidBy.loading,
      inactive: EXPENSES_COPY.form.paidBy.inactive,
      formerStaff: EXPENSES_COPY.form.paidBy.formerStaff,
      loadFailed: EXPENSES_COPY.form.paidBy.loadFailed,
    },
    amount: {
      label: 'Amount',
      /** "You have ₱8,450.00 on hand." */
      hint: (balance: string): string => `You have ${balance} on hand.`,
    },
    date: { label: 'Date', hint: "The day the cash changed hands. It can't be in the future." },
    note: { label: 'Note', placeholder: 'e.g. Cash for the fabric run', hint: 'Optional. Up to 200 characters.' },
    save: 'Record Transfer',
    toast: {
      title: 'Transfer recorded',
      /** "You now have ₱6,450.00 on hand." from the server's balance. */
      message: (balance: string): string => `You now have ${balance} on hand.`,
    },
    /** The server's own words for each rule (MoneyRules.cs), so the browser and the server say the same thing (OR-3). */
    errors: {
      toRequired: 'Choose who got the cash.',
      amountRequired: 'Enter the amount.',
      amountTooSmall: 'Enter an amount of at least ₱0.01.',
      amountDecimals: 'Use at most 2 decimal places.',
      dateRequired: 'Enter the transfer date.',
      dateInvalid: 'Enter a real date.',
      dateInFuture: "The transfer date can't be in the future.",
    },
  },
} as const;

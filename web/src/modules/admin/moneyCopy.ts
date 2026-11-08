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
    /** The Manager tabs (D-42). The Transfers tab arrives with plan 10-20. */
    tabs: {
      // SPEC-GAP: D-42 the tab strip's words.
      mine: 'Mine',
      staff: 'All Staff',
    },
  },
  /** The All Staff panel (UI-SPEC M1 "All Staff panel", D-42 to D-45; plan 10-19). */
  staff: {
    // SPEC-GAP: D-42 the card's head and line.
    title: 'All staff',
    sub: "Everyone's money on hand. Open a person to see their ledger.",
    /** The table's caption. */
    caption: 'Staff money on hand',
    /** The noun of the loading region and of the failure line: "Loading staff balances…", "Couldn't load staff balances.". */
    things: 'staff balances',
    columns: { person: 'Person', role: 'Role', status: 'Status', balance: 'Money on hand', actions: 'Actions' },
    /** The status words (D-43). */
    status: { active: 'Active', deactivated: 'Deactivated', deleted: 'Deleted' },
    /** After the signed-in Manager's own name. */
    you: ' (you)',
    /** The footer row (D-44). */
    total: 'Total held by staff',
    // SPEC-GAP: D-45 the row buttons. The visible word is "Hand Over"; the names say whose.
    handOver: 'Hand Over',
    handOverName: (name: string): string => `Hand over money from ${name}`,
    viewLedgerName: (name: string): string => `View ledger of ${name}`,
  },
  /** One person's money page, /admin/money/staff/:userId (UI-SPEC M2, D-42; plan 10-19). */
  person: {
    // SPEC-GAP: D-42 the back link, the subline and the document title.
    back: 'All staff',
    subline: 'Money on hand and ledger.',
    /** The document title is "{title} · CSPS Admin". */
    documentTitle: (name: string): string => `${name} · Money`,
    /** The title while the name is not known yet. */
    documentTitleFallback: 'Money',
    /** The loading region's noun: "Loading money on hand…". */
    things: 'money on hand',
    notFound: {
      title: "This person wasn't found.",
      message: 'Check the link, or go back to All Staff.',
      back: 'Back to All Staff',
    },
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
  /** The Ledger card of My Money (UI-SPEC M1 "Ledger card" and "Ledger rows", D-41, D-30). */
  ledger: {
    // SPEC-GAP: D-39 the card's head and line.
    title: 'Ledger',
    sub: 'Newest first. The balance after each entry is shown on the right.',
    /** The noun of the loading region and of the failure line: "Loading the ledger…", "Couldn't load the ledger.". */
    things: 'the ledger',
    columns: { date: 'Date', details: 'Details', moneyIn: 'Money in', moneyOut: 'Money out', balance: 'Balance' },
    /** The result bar: "Showing 6 entries · newest first" ("1 entry"). */
    result: { thing: 'entry', things: 'entries', orderNote: 'newest first' },
    /** The result bar with Show deleted on: "Showing 6 entries, deleted transfers included · newest first". */
    resultWithDeleted: {
      thing: 'entry, deleted transfers included',
      things: 'entries, deleted transfers included',
      orderNote: 'newest first',
    },
    // SPEC-GAP: D-39 the row titles. A transfer's title ends with the other person's name.
    titles: {
      payment: 'Payment received',
      refund: 'Refund handed back',
      transferFrom: 'Transfer from',
      transferTo: 'Transfer to',
      companyExpense: 'Company expense',
      orderExpense: 'Order expense',
    },
    /** Between the parts of a sub line. */
    joiner: ' · ',
    /** A hand-over's sub line ends with the Manager's name. */
    handedOverBy: 'Handed over by',
    // SPEC-GAP: D-30 the Manager-only filter and the look of a deleted transfer.
    showDeleted: 'Show deleted',
    deleted: 'Deleted',
    notCounted: 'Not counted',
    deletedBy: 'Deleted by',
    // SPEC-GAP: D-39 the empty state.
    empty: {
      title: 'No money in or out yet',
      message: 'Payments you receive, transfers and expenses you pay show here.',
    },
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
      /** The signed-in Manager in the hand-over list: "Carmen Reyes (you)". */
      you: EXPENSES_COPY.form.paidBy.you,
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
      nothingOnHand: 'You have nothing on hand to transfer.',
      /** "You only have ₱3,200.00 on hand." */
      aboveBalance: (balance: string): string => `You only have ${balance} on hand.`,
      noteTooLong: 'Keep the note to 200 characters or fewer.',
      /** A Manager sending to a leaver who is owed money (D-49): "Ana Villanueva is owed only ₱300.00. Enter that or less." */
      owedOnly: (name: string, owed: string): string => `${name} is owed only ${owed}. Enter that or less.`,
    },
  },
  /** The Hand Over Money window (UI-SPEC T1 mode handover, D-17, D-18; plan 10-19). The other fields use the Transfer Money words. */
  handover: {
    title: 'Hand Over Money',
    /** "From Jomar Santos (deactivated). They hold ₱2,000.00." */
    description: (name: string, status: 'deactivated' | 'deleted', held: string): string =>
      `From ${name} (${status}). They hold ${held}.`,
    amount: {
      /** "Jomar Santos holds ₱2,000.00." */
      hint: (name: string, held: string): string => `${name} holds ${held}.`,
    },
    // SPEC-GAP: T1 the note under the fields.
    note: (name: string): string => `This is recorded as a transfer from ${name}, with you as the one who recorded it.`,
    save: 'Record Handover',
    toast: {
      title: 'Handover recorded',
      /** "Jomar Santos now holds ₱0.00." from the server's balance. */
      message: (name: string, held: string): string => `${name} now holds ${held}.`,
    },
    /** The server's own words (MoneyRules.cs), so the browser and the server say the same thing (OR-3). */
    errors: {
      nothingOnHand: (name: string): string => `${name} has nothing on hand to hand over.`,
      /** "Jomar Santos only has ₱2,000.00 on hand." */
      aboveBalance: (name: string, held: string): string => `${name} only has ${held} on hand.`,
    },
  },
} as const;

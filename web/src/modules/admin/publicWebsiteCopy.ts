// The words of the Public website card and window of an order (UI-SPEC O1 and Copywriting; plan 11-27): one module, no wording in JSX.
// Strings the spec names are verbatim. SPEC-GAP: the empty option of "Show under" ("Choose a line") is not in the spec. No long dash (OR-4).

export const PUBLIC_WEBSITE_COPY = {
  /** The card (O1). */
  card: {
    title: 'Public website',
    edit: 'Edit',
    /** The Edit button's accessible name. */
    editName: 'Edit public website settings',
    rows: {
      customerOk: 'Customer OK',
      onWebsite: 'On the website',
      shownUnder: 'Shown under',
      nameShown: 'Name shown',
    },
    consentYes: (date: string | null, who: string | null): string =>
      ['Yes, recorded', date, who === null ? null : `by ${who}`].filter((part) => part !== null).join(' '),
    consentNo: 'No',
    shown: 'Shown',
    shownSince: (date: string): string => `since ${date}`,
    notShown: 'Not shown',
    needsPhoto: 'It shows once the order has a photo.',
    /** Follows the team when no name is set: "Brgy. San Roque Ballers (team name)". */
    teamSuffix: ' (team name)',
    cancelled: "Cancelled orders can't be shown on the website.",
  },
  /** The window (O1). */
  window: {
    title: 'Public Website',
    save: 'Save Changes',
  },
  /** The fields, shared with the order form card (plan 11-35). */
  fields: {
    consent: 'Customer said OK to show',
    consentHint: 'Tick only after the customer agrees. Their name, phone, prices and notes are never shown.',
    show: 'Show on the website',
    showBlockedHint: 'Tick Customer said OK to show first.',
    line: 'Show under',
    lineHint: "Picked from the order's items. Change it if another line fits better.",
    linePlaceholder: 'Choose a line',
    name: 'Name shown',
    nameHint: (team: string): string => `Leave empty to show the team name, ${team}.`,
    noTeamHint: 'This order has no team name. Enter the name to show.',
    /** "Visitors see: BRGY. SAN ROQUE BALLERS · Basketball · 17 pcs" (a labelled preview of the server's pieces). */
    preview: (parts: readonly string[]): string => `Visitors see: ${parts.join(' · ')}`,
    pieces: (count: string): string => `${count} pcs`,
  },
  /** The rules, in the server's words (OrderPublicSettings.cs). */
  errors: {
    consentFirst: 'Tick Customer said OK to show first.',
    lineRequired: 'Choose the product line to show this order under.',
    nameTooLong: 'Keep the name to 80 characters or fewer.',
    nameRequired: 'This order has no team name. Enter the name to show.',
  },
  /** The toasts of a save. */
  toast: {
    shown: {
      title: 'Order shown on the website',
      message: "It's in the Gallery now, and on the Home page while it's one of the 6 newest.",
    },
    takenOff: { title: 'Order taken off the website', message: 'Its photos stay on the order.' },
    saved: { title: 'Public website settings saved', message: (number: string): string => `${number} is updated.` },
  },
} as const;

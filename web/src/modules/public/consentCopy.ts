// The words of the cookie bar and the Cookie Settings window (UI-SPEC Copywriting "Consent bar, window and map"; ANL-01,
// D-16, D-36). They sit apart from copy.ts because only the lazy bar and window and the announcement use them, and
// copy.ts reaches every public page's first download (PERF-01). SPEC-GAP: CB1 and CS1 have no spec copy; these are the
// UI-SPEC strings.

export const CONSENT_COPY = {
  barLabel: 'Cookie choices',
  barText: 'We use cookies for visitor stats and the Google map, only if you say yes. See our',
  policyLink: 'Cookie Policy',
  barTextEnd: '.',
  settings: 'Cookie Settings',
  reject: 'Reject All',
  accept: 'Accept All',
  window: {
    title: 'Cookie Settings',
    description:
      'Choose which cookies this site may use. You can change this at any time from Cookie Settings at the bottom of every page.',
    policyLink: 'Read the Cookie Policy',
    /** "You chose on Nov 15, 2026. ..." from the already formatted date. */
    saved: (date: string) =>
      `You chose on ${date}. We'll ask again after 12 months, or sooner if our Cookie Policy changes.`,
    gpcNote: 'Your browser asked us not to track you, so visitor stats stay off.',
    legend: 'Your choices',
    necessary: {
      title: 'Necessary',
      badge: 'Always on',
      hint: "Keeps the site working: your cookie choice and staff sign-in. These don't track you.",
    },
    stats: {
      title: 'Visitor stats',
      // D-36: a retention line that a monthly job enforces says "about 13 months".
      hint: 'Counts visits, pages, where visitors came from and how fast pages load. No ads. Records are kept for about 13 months.',
      gpcHint: 'Off, because your browser asked us not to track you.',
    },
    map: {
      title: 'Google map',
      hint: 'Shows the shop map from Google on the Contact page. Google may set its own cookies.',
    },
    save: 'Save Choices',
  },
  // CS1 item 5 and CS2 (UI-SPEC Copywriting "Clear section", "Clear dialog", "Cleared", "Clear failed"; D-31, D-35).
  clear: {
    heading: 'Clear my cookies & data',
    description:
      "Removes this site's cookies and saved settings from this browser, and deletes the visit records linked to it on our server.",
    button: 'Clear My Cookies & Data',
    done: "Done. This site's cookies and your visit records are deleted. Visitor stats and the map are now off.",
    dialog: {
      title: 'Clear your cookies and data?',
      message:
        "This deletes this site's cookies and saved settings in this browser, and the visit records linked to them on our server. This can't be undone.",
      confirm: 'Clear My Data',
      pending: 'Clearing',
      keep: 'Keep My Data',
      failed: "Couldn't clear your data. Check your internet connection and try again.",
      // The words of the server's 429 for this call.
      rateLimited: 'Too many tries. Wait a minute and try again.',
    },
  },
} as const;
